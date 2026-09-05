import json

d = json.load(open('/opt/coolify-v4.3.17/openapi.json'))
schemas = d.get('components', {}).get('schemas', {})

print('--- all paths mentioning backup/project/database ---')
for p in d['paths']:
    if any(k in p for k in ('backup', 'project', 'postgresql', 'redis', 'environment', 'apply', 'dockerimage', 'deploy')):
        print('  ', p, sorted(m for m in d['paths'][p] if m in ('get', 'post', 'put', 'delete')))


def show(path, method='post'):
    item = d['paths'].get(path)
    if not item or method not in item:
        print('MISSING', method, path)
        return
    op = item[method]
    print('\n== %s %s  (%s)' % (method.upper(), path, op.get('summary')))
    rb = op.get('requestBody')
    if not rb:
        print('   params:', [p['name'] for p in op.get('parameters', [])])
        return
    sch = rb['content']['application/json']['schema']
    while '$ref' in sch:
        sch = schemas[sch['$ref'].split('/')[-1].replace('~1', '/')]
    req = sch.get('required', [])
    print('   required:', req)
    for k, v in sorted(sch.get('properties', {}).items()):
        t = v.get('type') or v.get('anyOf') or v.get('$ref', '')
        print('   - %-28s %-12s req=%-5s default=%-18s %s' % (
            k, str(t)[:12], k in req, str(v.get('default', '-'))[:18],
            str(v.get('description', ''))[:70]))


def show_response(path, method='post', code='201'):
    op = d['paths'].get(path, {}).get(method)
    if not op:
        print('MISSING resp', method, path)
        return
    r = op.get('responses', {})
    print('\n## responses for %s %s: %s' % (method.upper(), path, list(r.keys())))
    body = r.get(code) or {}
    try:
        sch = body['content']['application/json']['schema']
        while '$ref' in sch:
            sch = schemas[sch['$ref'].split('/')[-1].replace('~1', '/')]
        print('   201 properties:', sorted(sch.get('properties', {}).keys()))
    except Exception as e:
        print('   (no inline 201 schema:', e, ')')


show('/databases/postgresql')
show('/databases/redis')
show('/projects')
show('/projects/{uuid}/environments')
show('/databases/{uuid}/backups')
show('/applications/dockerimage')
show_response('/projects')
show_response('/databases/postgresql')
