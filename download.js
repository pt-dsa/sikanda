import fs from 'fs';

async function download(url, dest) {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(dest, buffer);
    console.log(`Successfully downloaded to ${dest} (${buffer.length} bytes)`);
  } catch (err) {
    console.error(`Error downloading ${url}:`, err.message);
  }
}

const dir = 'public';
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir);
}

download('https://lh3.googleusercontent.com/d/1PAbK2PRZfAkjtpMTy0vBJjR_1yatxIKN', 'public/logo_kota_tangerang_selatan.png');
