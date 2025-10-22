from globals import *
import mimetypes
import subprocess
import shutil

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
    return os.path.join(_user_base(), filename)

def _upsert_file_record(login: str, name: str, ftype: str, size: str):
    for i, x in enumerate(Accounts[login]["files"]):
        if x.get("file") == name:
            Accounts[login]["files"][i]["size"] = size
            Accounts[login]["files"][i]["last_change"] = datetime.datetime.today().strftime('%Y-%m-%d %H:%M')
            updateJson()
            return "Updated"
    file_data = {"file": name, "type": ftype, "size": size, "last_change": datetime.datetime.today().strftime('%Y-%m-%d %H:%M')}
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
    path = os.path.join(base, filename)

    if "." in filename:
        file_type = filename.split(".")[-1]
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
                    file_type = data["file"].split(".")[-1]
                    if file_type in file_types:
                        file_type = file_types[file_type]
                    else:
                        file_type = "Unknown"
                else:
                    file_type = "Unknown"

                base_dir = _user_base()
                os.makedirs(base_dir, exist_ok=True)
                handler = open(os.path.join(base_dir, data['file']), "w+", encoding='utf-8')
                handler.write(data["data"])
                handler.close()
                size = getFileSize(os.path.join(base_dir, data['file']))
                login = request.cookies.getlist('login')[0]
                return _upsert_file_record(login, data['file'], file_type, size)
            else:
                file = request.files['file']
                base_dir = _user_base()
                os.makedirs(base_dir, exist_ok=True)
                file_path = os.path.join(base_dir, file.filename)
                file.save(file_path)

                if "." in file.filename:
                    file_type = file.filename.split(".")[-1]
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
            new_list = [x for x in flist if x.get("file") != data["file"]]
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
            file_name = file_data.get("file")
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

def _is_dir_generic(info, file_type: str):
    try:
        if file_type == 'tar':
            return info.isdir()
        return info.is_dir()
    except Exception:
        return False

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