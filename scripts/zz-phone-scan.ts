import { config } from 'dotenv'; config({ path: '.env.local' });
// "Scan with phone" check without database writes, in one process (Redis or the in-memory fallback):
// "logic" runs both sides through the service; "qr <text>" encodes a QR code and decodes it back.
async function main() {
    const [mode, arg] = process.argv.slice(2);
    const { CpePhoneScanService: S } = await import('../src/services/inventory/cpe-phone-scan.service');
    const ok = (name: string, cond: boolean) => console.log(cond ? 'OK  ' : 'FAIL', name);
    const rejects = async (p: Promise<unknown>) => p.then(() => false, () => true);
    if (mode === 'logic') {
        const me = 'zz-user-1';
        const b = await S.create(me, { label: 'ONT serials from SLT', mode: 'batch' });
        ok('token is long and random', b.token.length >= 32);
        ok('phone sees the label and mode, no user data', JSON.stringify(await S.info(b.token)) === JSON.stringify({ label: 'ONT serials from SLT', mode: 'batch', closed: false, items: [] }));
        await S.add(b.token, ' s/n: abc123 ');
        await S.add(b.token, 'ABC123');
        await S.add(b.token, ['X1', 'X2']);
        const p = await S.poll(me, b.token, 0);
        ok('batch: normalised, duplicate ignored, order kept', JSON.stringify(p.items) === '["ABC123","X1","X2"]');
        ok('poll after=1 gives only the newer ones', JSON.stringify((await S.poll(me, b.token, 1)).items) === '["X1","X2"]');
        ok('another user cannot read the session', await rejects(S.poll('zz-user-2', b.token, 0)));
        ok('a wrong token is refused', await rejects(S.info('not-a-real-token-1234567890')) && await rejects(S.add('bad token!', 'X')));
        await S.close(me, b.token);
        ok('after the computer closes, the phone cannot add', await rejects(S.add(b.token, 'X3')));
        const s = await S.create(me, { label: 'STB serial', mode: 'single' });
        const r = await S.add(s.token, ['ONE', 'TWO']);
        ok('single: takes one serial and ends', JSON.stringify(r.added) === '["ONE"]' && r.closed === true);
        ok('single: a second scan is refused', await rejects(S.add(s.token, 'THREE')));
    }
    if (mode === 'qr') {
        const { QRCodeWriter, BarcodeFormat, EncodeHintType, QRCodeReader, BinaryBitmap, HybridBinarizer, RGBLuminanceSource } = await import('@zxing/library');
        const hints = new Map(); hints.set(EncodeHintType.MARGIN, 2);
        const m = new QRCodeWriter().encode(arg, BarcodeFormat.QR_CODE, 0, 0, hints);
        const k = 4, w = m.getWidth() * k, h = m.getHeight() * k, px = new Uint8ClampedArray(w * h);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px[y * w + x] = m.get(Math.floor(x / k), Math.floor(y / k)) ? 0 : 255;
        const text = new QRCodeReader().decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(px, w, h)))).getText();
        console.log('qr', m.getWidth(), 'modules; decoded back equal:', text === arg);
    }
    process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
