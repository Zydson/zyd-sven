from globals import *

ui_bp = Blueprint('ui', __name__)

@ui_bp.route("/user", methods=['GET'])
def UI():
    try:
        login = request.cookies.getlist('login')[0]
        token = request.cookies.getlist('token')[0]
        uid = request.cookies.getlist('uid')[0]

        if allowed(request):
            return render_template("/ui/ui.html", title="Desktop", login=login, token=token, uid=uid, wp=Accounts[login]["wallpaper"], date=datetime.datetime.now())
        else:
            return redirect("/", code=302)
    except:
        return redirect("/", code=302)
    
@ui_bp.route("/user/", methods=['GET'])
def mistake():
    return redirect("/user", code=302)

@ui_bp.route("/s/<folder>/<file>", methods=["GET"])
def brt(folder,file):
    return send_file(f"html/{folder}/{file}")

@ui_bp.route('/static/<path:filename>')
def static_files(filename):
    response = make_response(send_from_directory('static', filename))
    response.headers['Cache-Control'] = 'public, max-age=31536000, immutable'
    return response

@ui_bp.route('/wallpaper', methods=['GET'])
def getWallpaper():
    global Accounts
    login = request.cookies.getlist('login')[0]
    if allowed(request):
        return send_file(Accounts[login]["wallpaper"])