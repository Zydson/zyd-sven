from globals import *

notepad_bp = Blueprint('notes', __name__)

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

@notepad_bp.route('/save', methods=['POST'])
def save_notes():
    try:
        if allowed(request):
            data = request.get_json()
            file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], f"{request.cookies.getlist('uid')[0]}")+"/"
            handler = open(file_path+f"{data['file']}.txt", "w+")
            handler.write(data["text"])
            handler.close()
            size = getFileSize(file_path+f"{data['file']}.txt")
            
            for x in Accounts[request.cookies.getlist('login')[0]]["files"]:
                if x["file"] == data["file"]+".txt":
                    x["size"] = size
                    x["last_change"] = datetime.datetime.today().strftime('%Y-%m-%d %H:%M')
                    updateJson()
                    return "Updated"

            file_data = {"file":f"{data['file']}.txt","type":"Text document","size":size,"last_change":datetime.datetime.today().strftime('%Y-%m-%d %H:%M')}
            Accounts[request.cookies.getlist('login')[0]]["files"].append(file_data)

            updateJson()
            return file_data
        else:
            return make_response(jsonify({"error": "Unauthorized"}), 401)
    except Exception as e:
        print(f"[ERR] notepad/save - {str(e)}")
        return 500