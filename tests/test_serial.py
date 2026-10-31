import shutil
import struct
import subprocess
import tempfile
import unittest
from pathlib import Path

from signum.configuration import HardwareSettings
from signum.model import Engine, Quote
from signum.protocol import crc16, decode_response, encode, RESPONSE_BODY

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ['engine.v', 'uart_rx.v', 'uart_tx.v', 'packet_rx.v', 'signum_core.v']


class ResponseTests(unittest.TestCase):
    def test_response_decoder(self):
        body = RESPONSE_BODY.pack(b'NR', 1, 1, 42, -20, -100, 1)
        packet = body + struct.pack('<H', crc16(body))
        self.assertEqual(decode_response(packet), (42, -20, -100, True, 1))
        for i in range(20):
            damaged = bytearray(packet)
            damaged[i] ^= 1
            with self.assertRaises(ValueError): decode_response(damaged)
        with self.assertRaises(ValueError): decode_response(packet[:-1])


@unittest.skipUnless(shutil.which('iverilog') and shutil.which('vvp'), 'Icarus Verilog missing')
class SerialTests(unittest.TestCase):
    def simulate(self, commands, cpb=16, host_cpb=None):
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)
            source = directory / 'input.txt'
            source.write_text(''.join(f'{cmd} {value}\n' for cmd, value in commands), encoding='ascii')
            executable = directory / 'sim.vvp'
            subprocess.run(['iverilog', '-g2012', '-Wall', '-s', 'tb_serial',
                            f'-Ptb_serial.CPB={cpb}', f'-Ptb_serial.HOST_CPB={host_cpb or cpb}',
                            '-o', str(executable),
                            *[str(ROOT / 'rtl' / f) for f in SOURCES],
                            str(ROOT / 'tests/tb_serial.v')], check=True, timeout=30)
            result = subprocess.run(['vvp', str(executable), f'+INPUT={source.as_posix()}'],
                                    check=True, capture_output=True, text=True, timeout=60)
        raw = bytes(int(line.split()[1], 16) for line in result.stdout.splitlines()
                    if line.startswith('BYTE '))
        self.assertEqual(len(raw) % 20, 0, result.stdout)
        replies=[]
        for i in range(0,len(raw),20):
            packet=raw[i:i+20]
            if packet[2]==2:
                from signum.protocol import RESPONSE_BODY,crc16
                self.assertEqual(crc16(packet[:-2]),int.from_bytes(packet[-2:],'little'))
                magic,version,flags,seq,settings,maximum,cycles=RESPONSE_BODY.unpack(packet[:-2])
                self.assertEqual((magic,version,cycles),(b'NR',2,0))
                replies.append((seq,settings & 0xffffffff,maximum,flags==6,0))
            else: replies.append(decode_response(packet))
        engine = [tuple(map(int, line.split()[1:])) for line in result.stdout.splitlines()
                  if line.startswith('ENGINE ')]
        return replies, engine, result.stdout

    def test_configured_anchor_and_sma_match_python(self):
        import random
        from collections import deque
        rng=random.Random(42)
        commands=[];expected=[];engine_expected=[]
        for index,window in enumerate([None,2,4,8,16,32,64]):
            commands.append((2,0))
            settings=HardwareSettings(kind='anchor' if window is None else 'sma_reversion',
                threshold_ticks=7,max_order=3,position_limit=8,window=window or 20)
            commands.extend((0,b) for b in settings.encode(500+index))
            commands.append((1,16*230))
            expected.append((500+index,settings.packed(),3,False,0))
            model=Engine(threshold=7,max_order=3,limit=8)
            history=deque(maxlen=window or 2)
            for seq in range((window or 0)+100):
                q=Quote(seq,rng.choice([0,9990,10000,10010,0xffffffff]),rng.choice([0,1,10,65535]),seq==(window or 0)+90)
                if window and len(history)<window and not q.kill and not model.killed:
                    result=(0,model.position,0)
                else:
                    if window and history: model.fair=sum(history)//len(history)
                    result=model.step(q)
                history.append(q.price)
                expected.append((seq,result[0],result[1],bool(result[2]),1))
                engine_expected.append(result)
                commands.extend((0,b) for b in encode(q));commands.append((1,16*230))
        replies,engine,_=self.simulate(commands)
        self.assertEqual(replies,expected)
        self.assertEqual(engine,engine_expected)

    def test_configuration_is_atomic_locked_and_cannot_clear_kill(self):
        from signum.protocol import BODY,crc16
        def frame(settings):
            body=BODY.pack(b'NQ',2,2,50,settings,3)
            return body+crc16(body).to_bytes(2,'little')
        good=HardwareSettings(threshold_ticks=9,max_order=3,position_limit=8)
        commands=[]
        packets=[frame(0),good.encode(51),HardwareSettings(threshold_ticks=1).encode(52),
                 encode(Quote(1,9992,10)),encode(Quote(2,9990,10,True)),good.encode(53),
                 encode(Quote(3,0,10))]
        for packet in packets:
            commands.extend((0,b) for b in packet);commands.append((1,16*230))
        replies,engine,_=self.simulate(commands)
        self.assertTrue(replies[0][3]) # invalid config rejected without changing defaults
        self.assertEqual(replies[1],(51,good.packed(),3,False,0))
        self.assertTrue(replies[2][3]) # second config cannot replace settings
        self.assertEqual(replies[3][1:4],(0,0,False)) # threshold remains 9
        self.assertTrue(replies[5][3]) # kill cannot be cleared by config
        self.assertEqual(replies[-1][1:4],(0,0,True))
        self.assertEqual(engine,[(0,0,0),(0,0,1),(0,0,1)])

    def test_serial_risk_and_kill(self):
        quotes = [Quote(i, 9995, 65535) for i in range(7)]
        quotes += [Quote(7+i, 10005, 65535) for i in range(12)]
        quotes += [Quote(19, 0, 20, True), Quote(20, 0, 20)]
        commands = []
        expected = []
        model = Engine()
        for q in quotes:
            commands += [(0, b) for b in encode(q)] + [(1, 16*230)]
            order, position, killed = model.step(q)
            expected.append((q.sequence, order, position, bool(killed), 1))
        replies, engine, _ = self.simulate(commands)
        self.assertEqual(replies, expected)
        self.assertEqual(engine, [(r[1], r[2], int(r[3])) for r in expected])

    def test_corruption_timeout_framing_and_recovery(self):
        q = Quote(42, 9993, 28)
        packet = encode(q)
        commands = [(0, 0x12), (0, 0x4e)]  # noise then overlapping N N Q
        commands += [(0, b) for b in packet] + [(1, 16*230)]
        # Invalid header with a correct CRC still must be rejected.
        for offset in (2, 3):
            body = bytearray(packet[:-2]); body[offset] = 2
            damaged = body + struct.pack('<H', crc16(body))
            commands += [(0, b) for b in damaged]
        damaged = bytearray(packet); damaged[8] ^= 1
        commands += [(0, b) for b in damaged]
        # Partial frame times out, then framing error aborts another frame.
        commands += [(0, b) for b in packet[:7]] + [(1, 16*50)]
        commands += [(0, b) for b in packet[:5]] + [(3, 0x55), (1, 16*50)]
        commands += [(0, b) for b in packet] + [(1, 16*230)]
        replies, engine, stdout = self.simulate(commands)
        self.assertEqual(replies, [(42, 20, 20, False, 1), (42, 20, 40, False, 1)])
        self.assertEqual(len(engine), 2)
        self.assertIn('ERROR 1', stdout)

    def test_busy_drops_quote_and_reset_clears_kill(self):
        q = Quote(1, 0, 20, True)
        commands = [(0, b) for b in encode(q)]
        commands += [(0, b) for b in encode(Quote(2, 0, 20))]  # arrives during response
        commands += [(1, 16*250), (2, 0)]
        commands += [(0, b) for b in encode(Quote(3, 0, 20))]
        replies, _, _ = self.simulate(commands)
        self.assertEqual(replies, [(1, 0, 0, True, 1), (3, 20, 20, False, 1)])

    def test_production_baud_divider(self):
        commands = [(0, b) for b in encode(Quote(5, 10005, 21))]
        replies, _, _ = self.simulate(commands, cpb=234)
        self.assertEqual(replies, [(5, -20, -20, False, 1)])

    def test_baud_mismatch(self):
        commands = [(0, b) for b in encode(Quote(5, 9995, 21))]
        for host_cpb in (230, 238):
            with self.subTest(host_cpb=host_cpb):
                replies, _, _ = self.simulate(commands, cpb=234, host_cpb=host_cpb)
                self.assertEqual(replies, [(5, 20, 20, False, 1)])

    def test_false_start_and_reset_partial_packet(self):
        packet = encode(Quote(8, 9995, 21))
        commands = [(4, 0)] + [(0, b) for b in packet[:8]]
        commands += [(2, 0), (1, 16*3)] + [(0, b) for b in packet]
        replies, engine, stdout = self.simulate(commands)
        self.assertEqual(replies, [(8, 20, 20, False, 1)])
        self.assertEqual(engine, [(20, 20, 0)])
        self.assertIn('ERROR 0', stdout)

    def test_deleted_byte_then_idle_recovers(self):
        packet = encode(Quote(9, 10005, 20))
        commands = [(0, b) for b in packet[:8] + packet[9:]]
        commands += [(1, 16*50)] + [(0, b) for b in packet]
        replies, engine, _ = self.simulate(commands)
        self.assertEqual(replies, [(9, -20, -20, False, 1)])
        self.assertEqual(engine, [(-20, -20, 0)])
