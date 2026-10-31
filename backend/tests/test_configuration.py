import asyncio
from unittest.mock import patch
import pytest
from signum.configuration import HardwareSettings
from signum.protocol import BODY, RESPONSE_BODY, crc16
from signum.model import Quote
from signum.transport import SerialSession, CommunicationError
from backend.strategies import Strategy, StrategyEngine, StrategyStore
from backend.service import Controller, StartConfig

class ConfigSerial:
    def __init__(self,fault=None):
        self.writes=[];self.pending=b'';self.fault=fault;self.closed=False
    def reset_input_buffer(self): pass
    def write(self,packet):
        self.writes.append(packet)
        _,_,_,token,settings,maximum=BODY.unpack(packet[:-2])
        if self.fault=='timeout': return len(packet)
        if self.fault=='disconnect': raise OSError('USB disconnected')
        body=RESPONSE_BODY.pack(b'NR',1 if self.fault=='legacy' else 2,
             6 if self.fault=='reject' else 2,token+(self.fault=='sequence'),
             (settings if settings<2**31 else settings-2**32)+(self.fault=='readback'),maximum,0)
        self.pending=body+crc16(body).to_bytes(2,'little')
        if self.fault=='crc': self.pending=self.pending[:-1]+bytes([self.pending[-1]^1])
        return len(packet)
    def read(self,size):
        result,self.pending=self.pending[:3],self.pending[3:]
        return result
    def close(self): self.closed=True

@pytest.mark.parametrize('fault',['timeout','disconnect','legacy','reject','sequence','readback','crc'])
def test_failed_configuration_never_sends_quote_or_retries(fault):
    fake=ConfigSerial(fault)
    with patch('signum.transport.time.sleep'):
        session=SerialSession('fake',serial_factory=lambda *a,**k:fake)
        with pytest.raises(CommunicationError):
            session.configure(HardwareSettings(),StrategyEngine(Strategy()))
        with pytest.raises(CommunicationError): session.transact(Quote(0,9990,20))
        with pytest.raises(CommunicationError): session.configure(HardwareSettings(),StrategyEngine(Strategy()))
    assert len(fake.writes)==1 and session.failed


def test_acknowledgment_enables_custom_reference_and_locks_session():
    fake=ConfigSerial()
    spec=Strategy(kind='sma_reversion',window=16,max_order=3,position_limit=7)
    reference=StrategyEngine(spec)
    with patch('signum.transport.time.sleep') as pause:
        session=SerialSession('fake',serial_factory=lambda *a,**k:fake)
        result=session.configure(HardwareSettings(**{k:getattr(spec,k) for k in ('kind','window','threshold_ticks','max_order','position_limit')}),reference)
        assert result['state']=='acknowledged' and result['protocol']==2
        assert session.reference is reference and session.configured
        assert pause.call_args.args==(.002,)
        with pytest.raises(CommunicationError):session.configure(HardwareSettings(),reference)
    assert len(fake.writes)==1


def test_controller_configuration_failure_closes_port_and_never_reads_market():
    fake=ConfigSerial('timeout')
    async def scenario():
        with patch('signum.transport.time.sleep'):
            controller=Controller(session_factory=lambda port:SerialSession(port,serial_factory=lambda *a,**k:fake))
            await controller.start('owner',StartConfig(mode='fpga',port='fake',reset_confirmed=True))
            await controller.task
            assert controller.state=='error' and controller.latest is None
            assert controller.owner is None and controller.reset_required
            assert controller.hardware_configuration['state']=='failed'
        assert fake.closed and len(fake.writes)==1
    asyncio.run(scenario())


def test_persisted_compatibility_is_recomputed(tmp_path):
    store=StrategyStore(tmp_path)
    saved=store.save(None,Strategy(threshold_ticks=9),0)
    path=store.path(saved['id'])
    path.write_text(path.read_text().replace('"fpga_supported": true','"fpga_supported": false'))
    assert store.get(saved['id'])['fpga_supported']
