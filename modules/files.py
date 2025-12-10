from globals import *
import mimetypes
import subprocess
import shutil
import posixpath


files_bp = Blueprint('files', __name__)

file_types = {
    "txt": "Text document",
    "html": "Code", "htm": "Code", "xhtml": "Code",
    "css": "Code", "scss": "Code", "sass": "Code", "less": "Code",
    "js": "Code", "mjs": "Code",
    "ts": "Code", "tsx": "Code",
    "jsx": "Code",
    "json": "Code", "json5": "Code",
    "xml": "Code", "svg": "Code",
    "vue": "Code",
    "astro": "Code",
    "py": "Code", "pyw": "Code",
    "java": "Code",
    "kt": "Code", "kts": "Code",
    "scala": "Code",
    "groovy": "Code",
    "clj": "Code", "cljs": "Code",
    "c": "Code", "h": "Code",
    "cpp": "Code", "cc": "Code", "cxx": "Code",
    "hpp": "Code", "hh": "Code", "hxx": "Code",
    "cs": "Code", "csx": "Code",
    "fs": "Code", "fsx": "Code", "fsi": "Code",
    "vb": "Code",
    "go": "Code",
    "rs": "Code",
    "swift": "Code",
    "m": "Code", "mm": "Code",
    "php": "Code", "php3": "Code", "php4": "Code", "php5": "Code",
    "phtml": "Code",
    "rb": "Code", "rake": "Code", "gemspec": "Code",
    "erb": "Code",
    "lua": "Code",
    "sh": "Code", "bash": "Code", "zsh": "Code",
    "bat": "Code", "cmd": "Code",
    "ps1": "Code", "psm1": "Code",
    "jl": "Code",
    "md": "Code", "markdown": "Code",
    "rst": "Code",
    "tex": "Code", "latex": "Code",
    "asciidoc": "Code", "adoc": "Code",
    "textile": "Code",
    "yaml": "Code", "yml": "Code",
    "toml": "Code",
    "ini": "Code", "cfg": "Code", "conf": "Code",
    "properties": "Code",
    "sql": "Code",
    "mysql": "Code",
    "pgsql": "Code", "psql": "Code",
    "plsql": "Code",
    "pl": "Code", "pm": "Code",
    "r": "Code",
    "tcl": "Code",
    "hs": "Code",
    "elm": "Code",
    "erl": "Code", "hrl": "Code",
    "ex": "Code", "exs": "Code",
    "ml": "Code", "mli": "Code",
    "scm": "Code", "ss": "Code",
    "lisp": "Code", "lsp": "Code",
    "clue": "Code",
    "flix": "Code",
    "dart": "Code",
    "hx": "Code",
    "coffee": "Code",
    "cr": "Code",
    "d": "Code",
    "nim": "Code",
    "zig": "Code",
    "odin": "Code",
    "v": "Code",
    "vala": "Code",
    "pas": "Code", "pp": "Code",
    "ada": "Code", "adb": "Code", "ads": "Code",
    "cob": "Code", "cbl": "Code",
    "f": "Code", "f90": "Code", "f95": "Code",
    "asm": "Code", "s": "Code",
    "ejs": "Code",
    "jade": "Code", "pug": "Code",
    "haml": "Code",
    "slim": "Code",
    "handlebars": "Code", "hbs": "Code",
    "mustache": "Code",
    "twig": "Code",
    "nunjucks": "Code", "njk": "Code",
    "jinja": "Code", "jinja2": "Code",
    "django": "Code",
    "liquid": "Code",
    "smarty": "Code", "tpl": "Code",
    "ftl": "Code",
    "velocity": "Code", "vm": "Code",
    "dockerfile": "Code",
    "docker": "Code",
    "tf": "Code", "tfvars": "Code",
    "hcl": "Code",
    "proto": "Code",
    "graphql": "Code", "gql": "Code",
    "prisma": "Code",
    "nix": "Code",
    "htaccess": "Code",
    "nginx": "Code",
    "gitignore": "Code",
    "diff": "Code", "patch": "Code",
    "makefile": "Code", "mk": "Code",
    "csv": "Code",
    "tsv": "Code",
    "glsl": "Code", "vert": "Code", "frag": "Code",
    "vhd": "Code", "vhdl": "Code",
    "mat": "Code",
    "as": "Code",
    "applescript": "Code",
    "ahk": "Code",
    "bas": "Code",
    "cfm": "Code", "cfc": "Code",
    "ls": "Code",
    "styl": "Code",
    "pro": "Code",
    "maFile": "Code",
    "mafile": "Code",
    "png": "Image",
    "jpg": "Image",
    "jpeg": "Image",
    "gif": "Image",
    "bmp": "Image",
    "webp": "Image",
    "zip": "Archive",
    "rar": "Archive",
    "tar": "Archive",
    "mp4": "Video",
    "avi": "Video",
    "mkv": "Video",
    "webm": "Video",
    "mov": "Video",
    "flac": "Audio",
    "mp3": "Audio",
    "wav": "Audio",
    "ogg": "Audio",
    "m4a": "Audio",
}

def _user_base():
    uid = request.cookies.get('uid')
    return os.path.join(current_app.config['UPLOAD_FOLDER'], uid)

def _user_file_path(filename: str) -> str:
    base = _user_base()
    safe = str(filename or '').replace('\\', '/').strip()
    safe = posixpath.normpath(safe)
    if safe.startswith('../') or safe.startswith('..') or safe.startswith('/'):
        raise ValueError('Invalid path')
    full = os.path.join(base, safe)
    full = os.path.normpath(full)
    if not full.startswith(os.path.normpath(base) + os.sep) and os.path.normpath(base) != full:
        raise ValueError('Invalid path')
    return full

def _upsert_file_record(login: str, name: str, ftype: str, size: str):
    for i, x in enumerate(Accounts[login]["files"]):
        if x.get("file") == name:
            Accounts[login]["files"][i]["size"] = size
            Accounts[login]["files"][i]["last_change"] = datetime.datetime.today().strftime('%Y-%m-%d %H:%M')
            updateJson()
            return "Updated"
    file_data = {"file": name, "type": ftype, "size": size, "last_change": datetime.datetime.today().strftime('%Y-%m-%d %H:%M'), "uuid": str(uuid.uuid4())}
    Accounts[login]["files"].append(file_data)
    updateJson()
    return jsonify(file_data)

def getFileSize(filePath):
    try:
        num_bytes = os.path.getsize(filePath)
        units = ["B", "KB", "MB", "GB", "TB"]
        size = float(num_bytes)

        for unit in units:
            if size < 1024 or unit == units[-1]:
                return f"{size:.{2}f} {unit}"
            size /= 1024
    except FileNotFoundError:
        return 0

@files_bp.route('/list', methods=["GET"])
def list_files():
    try:
        if not allowed(request):
            return make_response(jsonify({"error": "Unauthorized"}), 401)

        login = request.cookies.get('login')
        files = Accounts[login]["files"]

        etag = hashlib.sha1(str(files).encode()).hexdigest()
        if request.headers.get('If-None-Match') == etag:
            return make_response('', 304, {
                'ETag': etag,
                'Cache-Control': 'public, must-revalidate'
            })

        resp = make_response(jsonify(files))
        resp.headers['ETag'] = etag
        resp.headers['Cache-Control'] = 'public, must-revalidate'
        return resp
    except Exception as e:
        print(f"[ERR] files/list - {str(e)}")
        return 500


@files_bp.route('/get/<path:file>', methods=["GET"])
def get_file(file):
    if not allowed(request):
        return make_response(jsonify({"error": "Unauthorized"}), 401)

    uid = request.cookies.get('uid')
    base = os.path.join(current_app.config['UPLOAD_FOLDER'], uid)
    filename = file.split("&")[0]
    try:
        path = _user_file_path(filename)
    except Exception:
        return make_response(jsonify({"error": "Invalid path"}), 400)

    if "." in filename:
        file_type = filename.split(".")[-1].lower()
        if file_type in file_types:
            file_type = file_types[file_type]
        else:
            file_type = "Unknown"
    else:
        file_type = "Unknown"

    if not os.path.isfile(path):
        return make_response(jsonify({"error": "Not found"}), 404)

    mtime = os.path.getmtime(path)
    etag = hashlib.sha1(f"{path}-{mtime}".encode()).hexdigest()
    
    if request.headers.get('If-None-Match') == etag:
        return make_response('', 304, {'ETag': etag,'Cache-Control': 'public, must-revalidate','Last-Modified': datetime.datetime.fromtimestamp(mtime).strftime('%a, %d %b %Y %H:%M:%S GMT')})

    if file_type == "Text document" or file_type == "Code":
        with open(path, encoding='utf-8') as fh:
            body = fh.read()
        resp = make_response(body)
        resp.headers['Content-Type'] = 'text/plain; charset=utf-8'
    else:
        resp = send_from_directory(base, filename, conditional=True)

    resp.headers.update({'ETag': etag,'Cache-Control': 'public, must-revalidate','Last-Modified': datetime.datetime.fromtimestamp(mtime).strftime('%a, %d %b %Y %H:%M:%S GMT')})
    return resp

@files_bp.route('/upload', methods=['POST'])
def upload_file():
    try:
        if allowed(request):
            if 'file' not in request.files:
                data = request.get_json()
                if "." in data["file"]:
                    file_type = data["file"].split(".")[-1].lower()
                    if file_type in file_types:
                        file_type = file_types[file_type]
                    else:
                        file_type = "Unknown"
                else:
                    file_type = "Unknown"

                base_dir = _user_base()
                os.makedirs(base_dir, exist_ok=True)
                target_path = _user_file_path(data['file'])
                os.makedirs(os.path.dirname(target_path), exist_ok=True)
                handler = open(target_path, "w+", encoding='utf-8')
                handler.write(data["data"])
                handler.close()
                size = getFileSize(target_path)
                login = request.cookies.getlist('login')[0]
                return _upsert_file_record(login, data['file'], file_type, size)
            else:
                file = request.files['file']
                base_dir = _user_base()
                os.makedirs(base_dir, exist_ok=True)
                file_path = _user_file_path(file.filename)
                os.makedirs(os.path.dirname(file_path), exist_ok=True)
                file.save(file_path)

                if "." in file.filename:
                    file_type = file.filename.split(".")[-1].lower()
                    if file_type in file_types:
                        file_type = file_types[file_type]
                    else:
                        file_type = "Unknown"
                else:
                    file_type = "Unknown"

                size = getFileSize(file_path)
                login = request.cookies.getlist('login')[0]
                return _upsert_file_record(login, file.filename, file_type, size)
        else:
            return make_response(jsonify({"error": "Unauthorized"}), 401)
    except Exception as e:
        print(f"[ERR] files/upload - {str(e)}")
        return 500

@files_bp.route('/remove', methods=['POST'])
def remove_file():
    try:
        if allowed(request):
            data = request.get_json()
            file_path = _user_file_path(data["file"])
            login = request.cookies.getlist('login')[0]
            flist = Accounts[login]["files"]
            if os.path.isdir(file_path):
                prefix = (data["file"].rstrip('/') + '/').replace('\\', '/')
                new_list = [x for x in flist if not (str(x.get("file") or '').replace('\\','/').startswith(prefix) or str(x.get("file") or '').replace('\\','/') == data["file"].rstrip('/')+'/')]
                new_list = [x for x in new_list if str(x.get("file") or '') != data["file"] and str(x.get("file") or '') != data["file"].rstrip('/')+'/']
                Accounts[login]["files"] = new_list
                updateJson()
                shutil.rmtree(file_path, ignore_errors=True)
                return "Removed"
            else:
                new_list = [x for x in flist if str(x.get("file") or '') != data["file"]]
                if len(new_list) != len(flist):
                    Accounts[login]["files"] = new_list
                    updateJson()
                if os.path.exists(file_path):
                    os.remove(file_path)
                    return "Removed"
                else:
                    return "File not found"
        else:
            return make_response(jsonify({"error": "Unauthorized"}), 401)
    except Exception as e:
        print(f"[ERR] files/remove - {str(e)}")
        return 500

@files_bp.route('/rename', methods=['POST'])
def rename_file():
    try:
        if not allowed(request):
            return make_response(jsonify({"error": "Unauthorized"}), 401)

        data = request.get_json() or {}
        old = (data.get('old') or '').strip()
        new = (data.get('new') or '').strip()

        if not old or not new:
            return make_response(jsonify({"error": "Invalid name"}), 400)

        if '.' not in new and '.' in old:
            new = f"{new}.{old.split('.')[-1]}"

        if '/' in new or '\\' in new or '/' in old or '\\' in old:
            return make_response(jsonify({"error": "Invalid path"}), 400)

        base = _user_base()
        old_path = os.path.join(base, old)
        new_path = os.path.join(base, new)

        if not os.path.exists(old_path):
            return make_response(jsonify({"error": "Not found"}), 404)
        if os.path.exists(new_path):
            return make_response(jsonify({"error": "File with that name already exists"}), 409)

        os.rename(old_path, new_path)

        login = request.cookies.get('login')
        files = Accounts[login]["files"]
        size = getFileSize(new_path)
        ext = new.rsplit('.', 1)[-1].lower() if '.' in new else ''
        ntype = file_types.get(ext, 'Unknown')
        idx = next((i for i,x in enumerate(files) if x.get("file") == old), -1)
        now = datetime.datetime.today().strftime('%Y-%m-%d %H:%M')
        if idx >= 0:
            files[idx].update({"file": new, "type": ntype, "size": size, "last_change": now})
        else:
            files.append({"file": new, "type": ntype, "size": size, "last_change": now})

        updateJson()
        return make_response(jsonify({"status": "Renamed", "file": new}), 200)
    except Exception as e:
        print(f"[ERR] files/rename - {str(e)}")
        return 500

@files_bp.route('/save-positions', methods=['POST'])
def save_positions():
    try:
        if not allowed(request):
            return make_response(jsonify({"error": "Unauthorized"}), 401)

        login = request.cookies.get('login')
        data = request.get_json()
        positions = data.get('positions', {})
        
        files = Accounts[login]["files"]
        for file_data in files:
            file_name = str(file_data.get("file") or '')
            if '/' in file_name.strip('/'): 
                file_data["position"] = None
                continue
            if file_name in positions:
                file_data["position"] = positions[file_name]
            elif "position" not in file_data:
                file_data["position"] = None
        
        updateJson()
        
        return make_response(jsonify({"status": "Saved"}), 200)
    except Exception as e:
        print(f"[ERR] files/save-positions - {str(e)}")
        return make_response(jsonify({"error": str(e)}), 500)

def get_file_info(info, file_type):
    size = 0
    is_dir = False
    modified = "N/A"
    name = ""

    if file_type == 'zip':
        size = info.file_size
        is_dir = info.is_dir()
        modified = datetime.datetime(*info.date_time).strftime('%Y-%m-%d %H:%M:%S')
        name = info.filename
    elif file_type == 'rar':
        size = info.file_size
        is_dir = info.is_dir()
        modified = datetime.datetime(*info.date_time).strftime('%Y-%m-%d %H:%M:%S')
        name = info.filename
    elif file_type == 'tar':
        size = info.size
        is_dir = info.isdir()
        modified = datetime.datetime.fromtimestamp(info.mtime).strftime('%Y-%m-%d %H:%M:%S')
        name = info.name

    units = ["B", "KB", "MB", "GB", "TB"]
    unit_index = 0
    if size > 0:
        while size >= 1024 and unit_index < len(units) - 1:
            size /= 1024
            unit_index += 1
    
    return {
        'name': name,
        'size': f"{size:.2f} {units[unit_index]}" if size > 0 else "0 B",
        'modified': modified,
        'is_dir': is_dir
    }

def _human_size(num_bytes: int):
    try:
        size = float(num_bytes)
    except Exception:
        return "0 B"
    units = ["B", "KB", "MB", "GB", "TB"]
    unit_index = 0
    while size >= 1024 and unit_index < len(units) - 1:
        size /= 1024
        unit_index += 1
    return f"{size:.2f} {units[unit_index]}"

def _entry_name(info):
    return getattr(info, 'filename', getattr(info, 'name', ''))

def _size_of(info, file_type: str):
    try:
        if file_type in ('zip', 'rar'):
            return info.file_size
        return info.size
    except Exception:
        return 0

def _modified_of(info, file_type: str):
    try:
        if file_type in ('zip', 'rar'):
            dt = getattr(info, 'date_time', None)
            if dt:
                return datetime.datetime(*dt).strftime('%Y-%m-%d %H:%M:%S')
        elif file_type == 'tar':
            mtime = getattr(info, 'mtime', None)
            if mtime:
                return datetime.datetime.fromtimestamp(mtime).strftime('%Y-%m-%d %H:%M:%S')
    except Exception:
        pass
    return "-"

def _norm_arc_path(name: str) -> str:
    n = str(name or '')
    n = n.replace('\\', '/').strip()
    while '//' in n:
        n = n.replace('//', '/')
    while n.startswith('./'):
        n = n[2:]
    n = n.lstrip('/')
    n = n.rstrip('/')
    return n

def _which_tool(candidates):
    for c in candidates:
        w = shutil.which(c)
        if w:
            return w
        if os.path.isabs(c) and os.path.exists(c):
            return c
    return None

def _safe_norm_path(p: str) -> str:
    s = str(p or '').replace('\\', '/').strip()
    s = posixpath.normpath(s)
    if s in ('', '.', './'):
        return ''
    if s.startswith('../') or s.startswith('..') or s.startswith('/'):
        raise ValueError('Invalid path')
    return s

_WIN_RESERVED_NAMES = {
    'CON','PRN','AUX','NUL',
    'COM1','COM2','COM3','COM4','COM5','COM6','COM7','COM8','COM9',
    'LPT1','LPT2','LPT3','LPT4','LPT5','LPT6','LPT7','LPT8','LPT9'
}

def _sanitize_windows_segment(seg: str) -> str:
    illegal = '<>:"\\/|?*'
    out = ''.join(('_' if ch in illegal else ch) for ch in seg)
    out = out.rstrip(' .')
    if not out:
        out = '_'
    base = out.split('.', 1)[0].upper()
    if base in _WIN_RESERVED_NAMES:
        out = f"{out}_"
    return out

def _sanitize_rel_path(rel: str) -> str:
    parts = [p for p in rel.split('/') if p not in ('', '.', '..')]
    safe_parts = [_sanitize_windows_segment(p) for p in parts]
    return '/'.join(safe_parts)

def _extract_rar_external_folder(archive_path: str, prefix: str, final_path: str) -> bool:
    import tempfile
    tmpdir = tempfile.mkdtemp(prefix='rar_bulk_')
    ok = False
    try:
        seven_zip = _which_tool([
            '7z', '7z.exe',
            r'C:\\Program Files\\7-Zip\\7z.exe',
            r'C:\\Program Files (x86)\\7-Zip\\7z.exe'
        ])
        pp = _norm_arc_path(prefix)
        pp = pp.rstrip('/')
        if seven_zip and os.path.exists(seven_zip):
            include_pat = f"-ir!{pp}/*"
            try:
                proc = subprocess.run([seven_zip, 'x', '-y', '-p-', archive_path, f"-o{tmpdir}", include_pat],
                                      stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
                if proc.returncode == 0:
                    ok = True
            except Exception:
                pass
        if not ok:
            unrar = _which_tool([
                'unrar', 'unrar.exe',
                r'C:\\Program Files\\WinRAR\\UnRAR.exe',
                r'C:\\Program Files\\WinRAR\\UnRAR64.exe',
                r'C:\\Program Files\\WinRAR\\unrar.exe',
                r'C:\\Program Files (x86)\\WinRAR\\UnRAR.exe',
                r'C:\\Program Files (x86)\\WinRAR\\UnRAR64.exe',
                r'C:\\Program Files (x86)\\WinRAR\\unrar.exe'
            ])
            if unrar and os.path.exists(unrar):
                pat = pp.replace('/', '\\') + '\\*'
                try:
                    proc = subprocess.run([unrar, 'x', '-y', archive_path, pat, tmpdir],
                                          stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
                    if proc.returncode == 0:
                        ok = True
                except Exception:
                    pass

        if ok:
            src_candidates = [os.path.join(tmpdir, pp), os.path.join(tmpdir, pp.replace('/', os.sep))]
            src_root = None
            for c in src_candidates:
                if os.path.exists(c):
                    src_root = c
                    break
            if not src_root:
                last = pp.split('/')[-1]
                c = os.path.join(tmpdir, last)
                if os.path.exists(c):
                    src_root = c
            if not src_root:
                return False
            os.makedirs(final_path, exist_ok=True)
            for name in os.listdir(src_root):
                s = os.path.join(src_root, name)
                d = os.path.join(final_path, name)
                try:
                    if os.path.exists(d):
                        if os.path.isdir(d) and os.path.isdir(s):
                            for root, dirs, files in os.walk(s):
                                rel = os.path.relpath(root, s)
                                tgt_dir = os.path.join(d, rel) if rel != '.' else d
                                os.makedirs(tgt_dir, exist_ok=True)
                                for fn in files:
                                    shutil.move(os.path.join(root, fn), os.path.join(tgt_dir, fn))
                        else:
                            if os.path.isdir(d):
                                shutil.rmtree(d, ignore_errors=True)
                            else:
                                try:
                                    os.remove(d)
                                except Exception:
                                    pass
                            shutil.move(s, d)
                    else:
                        shutil.move(s, d)
                except Exception as e:
                    print(f"[WARN] move after bulk extract failed: {s} -> {d} - {e}")
            return True
        return False
    finally:
        try:
            shutil.rmtree(tmpdir, ignore_errors=True)
        except Exception:
            pass

def _record_tree(login: str, root_rel: str, now: str):
    """Walk the extracted directory and upsert file/folder records."""
    base_path = _user_file_path(root_rel)
    files = Accounts[login]["files"]
    folder_key = root_rel.rstrip('/') + '/'
    if not any((x.get('file') == folder_key) for x in files):
        _upsert_file_record(login, folder_key, 'Folder', '-')
    for dirpath, dirnames, filenames in os.walk(base_path):
        rel_dir = os.path.relpath(dirpath, _user_base())
        rel_dir = rel_dir.replace('\\', '/')
        if rel_dir == '.':
            rel_dir = ''
        if rel_dir:
            dkey = rel_dir.rstrip('/') + '/'
            if not any((x.get('file') == dkey) for x in files):
                _upsert_file_record(login, dkey, 'Folder', '-')
        for fn in filenames:
            full = os.path.join(dirpath, fn)
            rel = os.path.relpath(full, _user_base()).replace('\\', '/')
            size = getFileSize(full)
            ext = rel.rsplit('.', 1)[-1].lower() if '.' in rel else ''
            ftype = file_types.get(ext, 'Unknown')
            existing = next((x for x in files if x.get('file') == rel), None)
            if existing:
                existing['size'] = size
                existing['last_change'] = now
                if '/' in rel:
                    existing['position'] = None
            else:
                _upsert_file_record(login, rel, ftype, size)

@files_bp.route('/folders/create', methods=['POST'])
def create_folder():
    try:
        if not allowed(request):
            return make_response(jsonify({"error": "Unauthorized"}), 401)

        data = request.get_json() or {}
        raw = (data.get('path') or '').strip()
        if not raw:
            return make_response(jsonify({"error": "Invalid name"}), 400)
        try:
            rel = _safe_norm_path(raw)
        except Exception:
            return make_response(jsonify({"error": "Invalid path"}), 400)

        full = _user_file_path(rel)
        os.makedirs(full, exist_ok=True)

        login = request.cookies.getlist('login')[0]
        files = Accounts[login]["files"]
        folder_key = rel.rstrip('/') + '/'
        exists = any((x.get('file') == folder_key) for x in files)
        if not exists:
            now = datetime.datetime.today().strftime('%Y-%m-%d %H:%M')
            rec = {"file": folder_key, "type": "Folder", "size": '-', "last_change": now, "position": None}
            files.append(rec)
            updateJson()
        else:
            rec = next(x for x in files if x.get('file') == folder_key)

        return make_response(jsonify(rec), 200)
    except Exception as e:
        print(f"[ERR] folders/create - {str(e)}")
        return make_response(jsonify({"error": "Failed to create folder"}), 500)

@files_bp.route('/folders/list', methods=['GET'])
def list_folder():
    try:
        if not allowed(request):
            return make_response(jsonify({"error": "Unauthorized"}), 401)
        path = request.args.get('path', '').strip()
        try:
            rel = _safe_norm_path(path)
        except Exception:
            return make_response(jsonify({"error": "Invalid path"}), 400)

        login = request.cookies.get('login')
        files = Accounts[login]["files"]
        prefix = rel.rstrip('/') + '/' if rel else ''
        results = {}
        for x in files:
            name = str(x.get('file') or '')
            nposix = name.replace('\\', '/')
            if not nposix.startswith(prefix):
                continue
            rest = nposix[len(prefix):]
            if rest == '':
                continue
            if '/' in rest.strip('/'): 
                first = rest.split('/', 1)[0] + '/'
                child_key = prefix + first
                results[child_key] = {
                    'name': child_key,
                    'display': first.rstrip('/'),
                    'size': '-',
                    'modified': '-',
                    'is_dir': True
                }
            else:
                is_dir = rest.endswith('/') or x.get('type') == 'Folder'
                if is_dir:
                    child_name = prefix + rest.rstrip('/') + '/'
                    results[child_name] = {
                        'name': child_name,
                        'display': rest.rstrip('/'),
                        'size': '-',
                        'modified': '-',
                        'is_dir': True
                    }
                else:
                    results[prefix + rest] = {
                        'name': prefix + rest,
                        'display': rest,
                        'size': x.get('size', '-'),
                        'modified': x.get('last_change', '-'),
                        'is_dir': False
                    }
        out = list(results.values())
        out.sort(key=lambda i: (not i['is_dir'], i['display'].lower()))
        return make_response(jsonify(out), 200)
    except Exception as e:
        print(f"[ERR] folders/list - {str(e)}")
        return make_response(jsonify({"error": "Failed to list folder"}), 500)

@files_bp.route('/move', methods=['POST'])
def move_file():
    try:
        if not allowed(request):
            return make_response(jsonify({"error": "Unauthorized"}), 401)
        data = request.get_json() or {}
        old = (data.get('old') or '').strip()
        new = (data.get('new') or '').strip()
        if not old or not new:
            return make_response(jsonify({"error": "Invalid move"}), 400)
        try:
            old_rel = _safe_norm_path(old)
            new_rel = _safe_norm_path(new)
        except Exception:
            return make_response(jsonify({"error": "Invalid path"}), 400)

        old_rel_norm = old_rel.rstrip('/')
        new_rel_norm = new_rel.rstrip('/')
        if old_rel_norm and (new_rel_norm == old_rel_norm or new_rel_norm.startswith(old_rel_norm + '/')):
            return make_response(jsonify({"error": "Cannot move a folder into itself"}), 400)

        old_path = _user_file_path(old_rel)
        new_path = _user_file_path(new_rel)
        moving_dir = os.path.isdir(old_path)
        os.makedirs(os.path.dirname(new_path), exist_ok=True)
        if not os.path.exists(old_path):
            print(f"[DEBUG] Move: old_path does not exist")
            login = request.cookies.get('login')
            files = Accounts[login]["files"]
            idx = next((i for i,x in enumerate(files) if str(x.get('file') or '') == old), -1)
            if idx >= 0:
                files.pop(idx)
                updateJson()
            return make_response(jsonify({"status": "Removed"}), 200)
        if os.path.exists(new_path):
            base_rel = new_rel.rstrip('/') if moving_dir else new_rel
            parent_rel = posixpath.dirname(base_rel)
            base_name = posixpath.basename(base_rel)
            stem = base_name
            ext = ''
            if not moving_dir and '.' in base_name:
                stem, ext = base_name.rsplit('.', 1)
                ext = '.' + ext
            candidate_rel = base_rel
            n = 1
            while os.path.exists(_user_file_path(candidate_rel)):
                candidate_name = f"{stem} ({n}){ext}"
                candidate_rel = posixpath.join(parent_rel, candidate_name) if parent_rel else candidate_name
                n += 1
            new_rel = candidate_rel
            new_path = _user_file_path(new_rel)
        os.rename(old_path, new_path)

        login = request.cookies.get('login')
        files = Accounts[login]["files"]
        idx = next((i for i,x in enumerate(files) if str(x.get("file") or '') == old), -1)
        size = getFileSize(new_path)
        now = datetime.datetime.today().strftime('%Y-%m-%d %H:%M')
        external_new_name = (new_rel.rstrip('/') + '/') if moving_dir else new_rel
        if idx >= 0:
            files[idx]['file'] = external_new_name
            files[idx]['size'] = size
            files[idx]['last_change'] = now
            if '/' in external_new_name:
                files[idx]['position'] = None
        else:
            ext = external_new_name.rsplit('.', 1)[-1].lower() if '.' in external_new_name else ''
            ntype = file_types.get(ext, 'Unknown')
            if moving_dir:
                ntype = 'Folder'
            files.append({"file": external_new_name, "type": ntype, "size": size, "last_change": now, "position": None})

        if moving_dir:
            old_prefix = (old.rstrip('/') + '/').replace('\\', '/')
            new_prefix = (external_new_name.rstrip('/') + '/').replace('\\', '/')
            for rec in files:
                fname = str(rec.get('file') or '')
                nposix = fname.replace('\\', '/')
                if nposix == old_prefix[:-1] or nposix.startswith(old_prefix):
                    if nposix == old_prefix[:-1]:
                        new_name = new_prefix[:-1]
                    else:
                        new_name = new_prefix + nposix[len(old_prefix):]
                    rec['file'] = new_name
                    rec['last_change'] = now
                    if '/' in rec['file']:
                        rec['position'] = None
        updateJson()
        return make_response(jsonify({"status": "Moved", "file": external_new_name}), 200)
    except Exception as e:
        print(f"[ERR] files/move - {str(e)}")
        return make_response(jsonify({"error": "Failed to move"}), 500)
def _extract_rar_external(archive_path: str, member: str) -> bytes | None:
    seven_zip = _which_tool([
        '7z', '7z.exe',
        r'C:\\Program Files\\7-Zip\\7z.exe',
        r'C:\\Program Files (x86)\\7-Zip\\7z.exe'
    ])
    targets = [member]
    if '/' in member:
        targets.append(member.replace('/', '\\'))
    elif '\\' in member:
        targets.append(member.replace('\\', '/'))

    if seven_zip:
        for t in targets:
            try:
                proc = subprocess.run([seven_zip, 'e', '-y', '-so', '-p-', archive_path, t],
                                      stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
                if proc.returncode == 0 and proc.stdout:
                    return proc.stdout
            except Exception:
                pass

    unrar = _which_tool([
        'unrar', 'unrar.exe',
        r'C:\\Program Files\\WinRAR\\UnRAR.exe',
        r'C:\\Program Files\\WinRAR\\UnRAR64.exe',
        r'C:\\Program Files\\WinRAR\\unrar.exe',
        r'C:\\Program Files (x86)\\WinRAR\\UnRAR.exe',
        r'C:\\Program Files (x86)\\WinRAR\\UnRAR64.exe',
        r'C:\\Program Files (x86)\\WinRAR\\unrar.exe'
    ])
    if unrar:
        for t in targets:
            try:
                proc = subprocess.run([unrar, 'p', '-inul', '-y', '-p-', archive_path, t],
                                      stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
                if proc.returncode == 0 and proc.stdout:
                    return proc.stdout
            except Exception:
                pass

    return None

@files_bp.route('/archive/get/<path:file>', methods=["GET"])
def get_archive_file(file):
    if not allowed(request):
        return make_response(jsonify({"error": "Unauthorized"}), 401)

    uid = request.cookies.get('uid')
    base = os.path.join(current_app.config['UPLOAD_FOLDER'], uid)
    archive_path = os.path.join(base, file)
    subpath = request.args.get('path', '')

    if not os.path.isfile(archive_path) or not subpath:
        return make_response(jsonify({"error": "Not found"}), 404)

    try:
        lower = file.lower()
        file_content = None
        filename = os.path.basename(subpath)
        norm_subpath = _norm_arc_path(subpath)

        mtime = os.path.getmtime(archive_path)
        content_key = f"{archive_path}:{norm_subpath}:{mtime}"
        etag = hashlib.sha1(content_key.encode()).hexdigest()
        
        if request.headers.get('If-None-Match') == etag:
            return make_response('', 304, {
                'ETag': etag,
                'Cache-Control': 'public, must-revalidate'
            })

        if lower.endswith('.zip'):
            with zipfile.ZipFile(archive_path, 'r') as zf:
                file_content = zf.read(norm_subpath)
        elif lower.endswith('.rar'):
            import tempfile
            
            try:
                with rarfile.RarFile(archive_path, 'r') as rf:
                    members = rf.namelist()
                    
                    target_member = None
                    if norm_subpath in members:
                        target_member = norm_subpath
                    else:
                        alt_path = norm_subpath.replace('/', '\\')
                        if alt_path in members:
                            target_member = alt_path
                        else:
                            norm_lower = norm_subpath.lower()
                            for m in members:
                                if _norm_arc_path(m).lower() == norm_lower:
                                    target_member = m
                                    break
                    
                    if target_member:
                        try:
                            with rf.open(target_member) as f:
                                file_content = f.read()
                        except Exception as e_open:
                            with tempfile.TemporaryDirectory() as tmpdir:
                                rf.extract(target_member, tmpdir)
                                extracted_path = os.path.join(tmpdir, target_member)
                                with open(extracted_path, 'rb') as f:
                                    file_content = f.read()
            except rarfile.RarCannotExec as e:
                fb = _extract_rar_external(archive_path, norm_subpath)
                if not fb:
                    fb = _extract_rar_external(archive_path, norm_subpath.replace('/', '\\'))
                if fb:
                    file_content = fb
                else:
                    raise
        elif lower.endswith('.tar'):
            with tarfile.open(archive_path, 'r') as tf:
                member = tf.getmember(norm_subpath)
                extracted_file = tf.extractfile(member)
                if extracted_file:
                    file_content = extracted_file.read()
        
        if file_content is None:
            return make_response(jsonify({"error": "File not found in archive"}), 404)

        ext = filename.split('.')[-1].lower() if '.' in filename else ''
        mime_types = {
            'mp3': 'audio/mpeg',
            'flac': 'audio/flac',
            'wav': 'audio/wav',
            'ogg': 'audio/ogg',
            'mp4': 'video/mp4',
            'avi': 'video/x-msvideo',
            'mkv': 'video/x-matroska',
            'webm': 'video/webm',
            'gif': 'image/gif',
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'txt': 'text/plain'
        }
        mimetype = mime_types.get(ext) or mimetypes.guess_type(filename)[0] or 'application/octet-stream'
        
        resp = make_response(file_content)
        resp.headers['Content-Type'] = mimetype
        resp.headers['ETag'] = etag
        resp.headers['Cache-Control'] = 'public, must-revalidate'
        
        return resp

    except (KeyError, rarfile.NoRarEntry) as e:
        print(f"[WARN] files/archive/get - File not found in archive: {archive_path} -> {norm_subpath}")
        return make_response(jsonify({"error": "File not found in archive"}), 404)
    except rarfile.NeedFirstVolume as e:
        print(f"[ERR] files/archive/get - Multi-volume RAR not supported: {str(e)}")
        return make_response(jsonify({"error": "Multi-volume RAR archives are not supported"}), 400)
    except rarfile.RarCannotExec as e:
        print(f"[ERR] files/archive/get - Cannot find working tool: {str(e)}")
        return make_response(jsonify({"error": "RAR support not available - UnRAR tool not found"}), 500)
    except Exception as e:
        print(f"[ERR] files/archive/get - {str(e)}")
        import traceback
        traceback.print_exc()
        return make_response(jsonify({"error": "Failed to read file from archive"}), 500)

@files_bp.route('/archive/list/<path:file>', methods=["GET"])
def list_archive_files(file):
    if not allowed(request):
        return make_response(jsonify({"error": "Unauthorized"}), 401)

    uid = request.cookies.get('uid')
    base = os.path.join(current_app.config['UPLOAD_FOLDER'], uid)
    path = os.path.join(base, file)
    subpath = request.args.get('path', '')

    if not os.path.isfile(path):
        return make_response(jsonify({"error": "Not found"}), 404)

    try:
        lower = file.lower()
        file_type = None
        entry_map = {}

        if lower.endswith('.zip'):
            file_type = 'zip'
            with zipfile.ZipFile(path, 'r') as zf:
                for i in zf.infolist():
                    n = _norm_arc_path(_entry_name(i))
                    if n:
                        entry_map[n] = i
        elif lower.endswith('.rar'):
            file_type = 'rar'
            with rarfile.RarFile(path, 'r') as rf:
                for i in rf.infolist():
                    n = _norm_arc_path(_entry_name(i))
                    if n:
                        entry_map[n] = i
        elif lower.endswith('.tar'):
            file_type = 'tar'
            with tarfile.open(path, 'r') as tf:
                for i in tf.getmembers():
                    n = _norm_arc_path(_entry_name(i))
                    if n:
                        entry_map[n] = i
        else:
            return make_response(jsonify({"error": "Unsupported archive type"}), 400)

        norm_sub = _norm_arc_path(subpath or '')

        children_paths = set()
        for full_name in entry_map.keys():
            if norm_sub:
                if not (full_name == norm_sub or full_name.startswith(norm_sub + '/')):
                    continue
                if full_name == norm_sub:
                    rel = ''
                else:
                    rel = full_name[len(norm_sub) + 1:]
            else:
                rel = full_name

            if not rel:
                continue

            first_seg = rel.split('/', 1)[0]
            if not first_seg:
                continue
            child_path = f"{norm_sub}/{first_seg}" if norm_sub else first_seg
            children_paths.add(child_path)

        results = []
        for child in sorted(children_paths, key=lambda x: x.lower()):
            is_dir = any(name != child and name.startswith(child + '/') for name in entry_map.keys())
            if is_dir:
                results.append({
                    'name': child,
                    'display': child.split('/')[-1],
                    'size': '-',
                    'modified': '-',
                    'is_dir': True
                })
            else:
                src = entry_map.get(child)
                results.append({
                    'name': child,
                    'display': child.split('/')[-1],
                    'size': _human_size(_size_of(src, file_type)) if src else '-',
                    'modified': _modified_of(src, file_type) if src else '-',
                    'is_dir': False
                })

        results.sort(key=lambda x: (not x['is_dir'], x['display'].lower()))
        return make_response(jsonify(results))

    except Exception as e:
        print(f"[ERR] files/archive/list - {str(e)}")
        return make_response(jsonify({"error": "Failed to read archive"}), 500)


@files_bp.route('/archive/extract', methods=['POST'])
def extract_from_archive():
    try:
        if not allowed(request):
            return make_response(jsonify({"error": "Unauthorized"}), 401)

        data = request.get_json() or {}
        archive_rel = (data.get('archive') or '').strip()
        internal_path = (data.get('path') or '').strip()
        dest_name = (data.get('dest') or '').strip()
        if not archive_rel or not internal_path:
            return make_response(jsonify({"error": "Invalid request"}), 400)

        try:
            archive_rel_norm = _safe_norm_path(archive_rel)
        except Exception:
            return make_response(jsonify({"error": "Invalid archive path"}), 400)

        uid = request.cookies.get('uid')
        base = os.path.join(current_app.config['UPLOAD_FOLDER'], uid)
        archive_path = os.path.join(base, archive_rel_norm)
        if not os.path.isfile(archive_path):
            return make_response(jsonify({"error": "Archive not found"}), 404)

        norm_sub = _norm_arc_path(internal_path)
        if not norm_sub:
            return make_response(jsonify({"error": "Invalid internal path"}), 400)

        lower = archive_rel.lower()

        entry_map = {}
        arc_type = None
        if lower.endswith('.zip'):
            arc_type = 'zip'
            with zipfile.ZipFile(archive_path, 'r') as zf:
                for i in zf.infolist():
                    n = _norm_arc_path(_entry_name(i))
                    if n:
                        entry_map[n] = i
        elif lower.endswith('.rar'):
            arc_type = 'rar'
            try:
                with rarfile.RarFile(archive_path, 'r') as rf:
                    for i in rf.infolist():
                        n = _norm_arc_path(_entry_name(i))
                        if n:
                            entry_map[n] = i
            except rarfile.RarCannotExec:
                return make_response(jsonify({"error": "RAR extraction not available"}), 500)
        elif lower.endswith('.tar'):
            arc_type = 'tar'
            with tarfile.open(archive_path, 'r') as tf:
                for i in tf.getmembers():
                    n = _norm_arc_path(_entry_name(i))
                    if n:
                        entry_map[n] = i
        else:
            return make_response(jsonify({"error": "Unsupported archive type"}), 400)

        is_dir = any((k == norm_sub and (getattr(entry_map[k], 'is_dir', False) if arc_type == 'tar' else (str(k).endswith('/') or False))) for k in entry_map)
        if not is_dir:
            prefix = norm_sub.rstrip('/') + '/'
            is_dir = any(name.startswith(prefix) for name in entry_map.keys())

        base_name = dest_name or norm_sub.rstrip('/').split('/')[-1]
        base_name = _sanitize_windows_segment(base_name)
        if not base_name:
            return make_response(jsonify({"error": "Invalid destination name"}), 400)

        if is_dir:
            desired_rel = base_name.rstrip('/') + '/'
        else:
            desired_rel = base_name

        parent_rel = posixpath.dirname(desired_rel.rstrip('/'))
        base_only = posixpath.basename(desired_rel.rstrip('/'))
        stem = base_only
        ext = ''
        if not is_dir and '.' in base_only:
            stem, ext = base_only.rsplit('.', 1)
            ext = '.' + ext
        candidate_rel = desired_rel.rstrip('/')
        n = 1
        while True:
            candidate_path = _user_file_path(candidate_rel + ('/' if is_dir else ''))
            if not os.path.exists(candidate_path):
                break
            candidate_name = f"{stem} ({n}){ext}"
            candidate_rel = posixpath.join(parent_rel, candidate_name) if parent_rel else candidate_name
            n += 1
        final_rel = candidate_rel + ('/' if is_dir else '')
        final_path = _user_file_path(final_rel)

        os.makedirs(final_path if is_dir else os.path.dirname(final_path), exist_ok=True)

        written_files = []
        created_dirs = set()
        now = datetime.datetime.today().strftime('%Y-%m-%d %H:%M')
        if is_dir:
            prefix = norm_sub.rstrip('/') + '/'
            if arc_type == 'zip':
                with zipfile.ZipFile(archive_path, 'r') as zf:
                    for info in zf.infolist():
                        name = _norm_arc_path(_entry_name(info))
                        if not name.startswith(prefix):
                            continue
                        rel_sub = name[len(prefix):]
                        if not rel_sub:
                            continue
                        rel_sub = _sanitize_rel_path(rel_sub)
                        target_rel = posixpath.join(final_rel.rstrip('/'), rel_sub)
                        target_path = _user_file_path(target_rel)
                        if getattr(info, 'is_dir', lambda: False)() if hasattr(info, 'is_dir') else name.endswith('/'):
                            os.makedirs(target_path, exist_ok=True)
                            created_dirs.add((target_rel.rstrip('/') + '/').replace('\\', '/'))
                        else:
                            os.makedirs(os.path.dirname(target_path), exist_ok=True)
                            try:
                                with zf.open(info, 'r') as src, open(target_path, 'wb') as out:
                                    shutil.copyfileobj(src, out)
                                written_files.append(target_rel.replace('\\', '/'))
                            except Exception as e:
                                print(f"[WARN] zip extract skip: {target_rel} - {e}")
                            parent = posixpath.dirname(target_rel)
                            while parent and parent.startswith(final_rel.rstrip('/')):
                                created_dirs.add((parent.rstrip('/') + '/').replace('\\', '/'))
                                new_parent = posixpath.dirname(parent)
                                if new_parent == parent:
                                    break
                                parent = new_parent
            elif arc_type == 'rar':
                bulk_ok = _extract_rar_external_folder(archive_path, prefix, final_path)
                if not bulk_ok:
                    try:
                        with rarfile.RarFile(archive_path, 'r') as rf:
                            for info in rf.infolist():
                                name = _norm_arc_path(_entry_name(info))
                                if not name.startswith(prefix):
                                    continue
                                rel_sub = name[len(prefix):]
                                if not rel_sub:
                                    continue
                                rel_sub = _sanitize_rel_path(rel_sub)
                                target_rel = posixpath.join(final_rel.rstrip('/'), rel_sub)
                                target_path = _user_file_path(target_rel)
                                if callable(getattr(info, 'is_dir', None)) and info.is_dir():
                                    os.makedirs(target_path, exist_ok=True)
                                    created_dirs.add((target_rel.rstrip('/') + '/').replace('\\', '/'))
                                else:
                                    os.makedirs(os.path.dirname(target_path), exist_ok=True)
                                    try:
                                        with rf.open(info) as src, open(target_path, 'wb') as out:
                                            shutil.copyfileobj(src, out)
                                        written_files.append(target_rel.replace('\\', '/'))
                                    except Exception as e:
                                        fb = _extract_rar_external(archive_path, name)
                                        if fb:
                                            with open(target_path, 'wb') as out:
                                                out.write(fb)
                                            written_files.append(target_rel.replace('\\', '/'))
                                        else:
                                            print(f"[WARN] rar extract skip: {target_rel} - {e}")
                                    parent = posixpath.dirname(target_rel)
                                    while parent and parent.startswith(final_rel.rstrip('/')):
                                        created_dirs.add((parent.rstrip('/') + '/').replace('\\', '/'))
                                        new_parent = posixpath.dirname(parent)
                                        if new_parent == parent:
                                            break
                                        parent = new_parent
                    except rarfile.RarCannotExec:
                        return make_response(jsonify({"error": "RAR extraction not available"}), 500)
            elif arc_type == 'tar':
                with tarfile.open(archive_path, 'r') as tf:
                    for info in tf.getmembers():
                        name = _norm_arc_path(_entry_name(info))
                        if not name.startswith(prefix):
                            continue
                        rel_sub = name[len(prefix):]
                        if not rel_sub:
                            continue
                        rel_sub = _sanitize_rel_path(rel_sub)
                        target_rel = posixpath.join(final_rel.rstrip('/'), rel_sub)
                        target_path = _user_file_path(target_rel)
                        if info.isdir():
                            os.makedirs(target_path, exist_ok=True)
                            created_dirs.add((target_rel.rstrip('/') + '/').replace('\\', '/'))
                        else:
                            os.makedirs(os.path.dirname(target_path), exist_ok=True)
                            src = tf.extractfile(info)
                            if src:
                                try:
                                    with open(target_path, 'wb') as out:
                                        shutil.copyfileobj(src, out)
                                    written_files.append(target_rel.replace('\\', '/'))
                                except Exception as e:
                                    print(f"[WARN] tar extract skip: {target_rel} - {e}")
                                parent = posixpath.dirname(target_rel)
                                while parent and parent.startswith(final_rel.rstrip('/')):
                                    created_dirs.add((parent.rstrip('/') + '/').replace('\\', '/'))
                                    new_parent = posixpath.dirname(parent)
                                    if new_parent == parent:
                                        break
                                    parent = new_parent
        else:
            if arc_type == 'zip':
                with zipfile.ZipFile(archive_path, 'r') as zf:
                    try:
                        with zf.open(norm_sub, 'r') as src, open(final_path, 'wb') as out:
                            shutil.copyfileobj(src, out)
                    except Exception as e:
                        return make_response(jsonify({"error": f"Failed to extract file: {e}"}), 500)
                written_files.append(final_rel.replace('\\', '/'))
            elif arc_type == 'rar':
                try:
                    with rarfile.RarFile(archive_path, 'r') as rf:
                        try:
                            with rf.open(norm_sub) as src, open(final_path, 'wb') as out:
                                shutil.copyfileobj(src, out)
                        except Exception as e:
                            fb = _extract_rar_external(archive_path, norm_sub)
                            if fb:
                                with open(final_path, 'wb') as out:
                                    out.write(fb)
                            else:
                                return make_response(jsonify({"error": f"Failed to extract file: {e}"}), 500)
                    written_files.append(final_rel.replace('\\', '/'))
                except rarfile.RarCannotExec:
                    fb = _extract_rar_external(archive_path, norm_sub)
                    if fb:
                        with open(final_path, 'wb') as out:
                            out.write(fb)
                        written_files.append(final_rel.replace('\\', '/'))
                    else:
                        return make_response(jsonify({"error": "RAR extraction not available"}), 500)
            elif arc_type == 'tar':
                with tarfile.open(archive_path, 'r') as tf:
                    mem = tf.getmember(norm_sub)
                    src = tf.extractfile(mem)
                    if not src:
                        return make_response(jsonify({"error": "Not found in archive"}), 404)
                    try:
                        with open(final_path, 'wb') as out:
                            shutil.copyfileobj(src, out)
                    except Exception as e:
                        return make_response(jsonify({"error": f"Failed to extract file: {e}"}), 500)
                written_files.append(final_rel.replace('\\', '/'))

        login = request.cookies.get('login')
        files = Accounts[login]["files"]
        if is_dir:
            folder_key = final_rel.rstrip('/') + '/'
            if not any((x.get('file') == folder_key) for x in files):
                _upsert_file_record(login, folder_key, 'Folder', '-')
            if 'bulk_ok' in locals() and bulk_ok:
                _record_tree(login, final_rel.rstrip('/') + '/', now)
            else:
                for d in sorted(created_dirs):
                    if not any((x.get('file') == d) for x in files):
                        _upsert_file_record(login, d, 'Folder', '-')
                for rel in written_files:
                    try:
                        file_size = getFileSize(_user_file_path(rel))
                    except Exception:
                        file_size = '-'
                    ext = rel.rsplit('.', 1)[-1].lower() if '.' in rel else ''
                    ftype = file_types.get(ext, 'Unknown')
                    _upsert_file_record(login, rel, ftype, file_size)
        else:
            rel = final_rel
            try:
                file_size = getFileSize(_user_file_path(rel))
            except Exception:
                file_size = '-'
            ext = rel.rsplit('.', 1)[-1].lower() if '.' in rel else ''
            ftype = file_types.get(ext, 'Unknown')
            _upsert_file_record(login, rel, ftype, file_size)

        updateJson()
        return make_response(jsonify({"status": "Extracted", "file": (final_rel if is_dir else final_rel)}), 200)
    except Exception as e:
        print(f"[ERR] files/archive/extract - {str(e)}")
        import traceback
        traceback.print_exc()
        return make_response(jsonify({"error": "Failed to extract"}), 500)
