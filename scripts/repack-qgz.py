#!/usr/bin/env python3
"""Repack the QGIS.qgz archive with the patched QGIS.qgs file."""
import zipfile
import os
import shutil

base = 'QGIS Project Template'

# Backup existing QGIS.qgz
qgz_path = os.path.join(base, 'QGIS.qgz')
qgs_path = os.path.join(base, 'QGIS.qgs')

if os.path.exists(qgz_path):
    bak_num = 5
    while os.path.exists(os.path.join(base, f'QGIS.qgz.bak{bak_num}')):
        bak_num += 1
    shutil.copy2(qgz_path, os.path.join(base, f'QGIS.qgz.bak{bak_num}'))
    print(f'Created backup: QGIS.qgz.bak{bak_num}')

# Read old .qgz to get any additional files
extra_files = {}
try:
    with zipfile.ZipFile(qgz_path, 'r') as zf:
        for f in zf.namelist():
            if f != 'QGIS.qgs':
                extra_files[f] = zf.read(f)
                print(f'Extra file in archive: {f} ({len(extra_files[f])} bytes)')
except Exception as e:
    print(f'Error reading old archive: {e}')

# Create new archive
with zipfile.ZipFile(qgz_path, 'w', zipfile.ZIP_DEFLATED) as zf:
    zf.write(qgs_path, arcname='QGIS.qgs')
    for name, data in extra_files.items():
        zf.writestr(name, data)

# Verify
with zipfile.ZipFile(qgz_path, 'r') as zf:
    print(f'\nNew archive contents: {zf.namelist()}')
    info = zf.getinfo('QGIS.qgs')
    print(f'QGIS.qgs size: {info.file_size} bytes')

print(f'Final .qgz size: {os.path.getsize(qgz_path)} bytes')
print('\nRepack complete!')