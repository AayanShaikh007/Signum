"""Versioned, bounded hardware settings; no executable strategy code is sent."""
from dataclasses import dataclass
from .protocol import BODY, RESPONSE_BODY, crc16

FPGA_WINDOWS=(2,4,8,16,32,64)

@dataclass(frozen=True)
class HardwareSettings:
    kind:str='anchor'
    threshold_ticks:int=5
    max_order:int=20
    position_limit:int=100
    window:int=20

    def packed(self):
        if self.kind not in ('anchor','sma_reversion'):
            raise ValueError('Unsupported hardware strategy')
        if not (1<=self.threshold_ticks<=500 and 1<=self.max_order<=20 and 1<=self.position_limit<=100):
            raise ValueError('Hardware settings exceed supported risk bounds')
        shift=0
        if self.kind=='sma_reversion':
            if self.window not in FPGA_WINDOWS:
                raise ValueError('FPGA moving-average window must be 2, 4, 8, 16, 32 or 64')
            shift=self.window.bit_length()-1
        return ((int(self.kind=='sma_reversion')<<31) | (shift<<28) |
                (self.position_limit<<16) | self.threshold_ticks)

    def encode(self,token):
        body=BODY.pack(b'NQ',2,2,token,self.packed(),self.max_order)
        return body+crc16(body).to_bytes(2,'little')

    def verify_ack(self,packet,token):
        if len(packet)!=20: raise ValueError('Configuration response length')
        if crc16(packet[:-2])!=int.from_bytes(packet[-2:],'little'):
            raise ValueError('Configuration response CRC')
        magic,version,flags,sequence,packed,maximum,cycles=RESPONSE_BODY.unpack(packet[:-2])
        if magic!=b'NR' or version!=2 or flags not in (2,6) or cycles!=0:
            raise ValueError('Unsupported firmware configuration acknowledgment')
        if flags==6: raise ValueError('FPGA rejected settings; physically reset before configuring')
        if sequence!=token or packed & 0xffffffff!=self.packed() or maximum!=self.max_order:
            raise ValueError('FPGA configuration readback mismatch')
