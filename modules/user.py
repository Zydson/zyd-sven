from globals import *

user_bp = Blueprint('user', __name__)

def RegisterUser(username,password):
    if username in Accounts:
        return "Username already exists"
    if "salt" == username:
        return "Invalid username"
    if len(password) < 8:
        return "Password too short"
        
    uid = ''.join(random.choice(string.ascii_letters) for i in range(8))
    token = ''.join(random.choice(string.ascii_letters) for i in range(32))
    Accounts[username] = {
        "username": username,
        "password": f'{bcrypt.hashpw(password.encode(),Accounts["salt"].encode())}',
        "created_at": datetime.datetime.today().strftime('%Y-%m-%d %H:%M'),
        "uid": uid,
        "token": token,
        "files": [],
        "file_positions": [],
        "wallpaper": "static/default.jpg",
    }
    updateJson()
    try:
        os.mkdir(f"accounts/{uid}")
    except:
        pass
    
    return "OK"

@user_bp.route("/register", methods=['POST'])
def Register():
    try:
        data = request.get_json()
        csrf = request.headers.get("csrf","")
        
        if csrf not in csrfData or csrfData[csrf]["ua"] != request.headers.get("User-Agent"):
            return {"status": "Invalid CSRF"}
            
        username = data.get("login")
        password = data.get("password")
        
        if not username or not password:
             return {"status": "Missing credentials"}

        result = RegisterUser(username, password)
        return {"status": result}
    except Exception as e:
        print(f"Register err: {str(e)}")
        return {"status": "Error"}

@user_bp.route("/check_username", methods=['POST'])
def CheckUsername():
    try:
        data = request.get_json()
        username = data.get("login")
        if username in Accounts:
            return {"available": False}
        return {"available": True}
    except:
        return {"available": False}

@user_bp.route("/login", methods=['POST'])
def Login():
    try:
        data = request.get_json()
        csrf = request.headers.get("csrf","")
        
        if csrf not in csrfData or csrfData[csrf]["ua"] != request.headers.get("User-Agent"):
            return {"token": "none", "uid": "none"}
        
        if str(Accounts[data["login"]]["password"]) == str(bcrypt.hashpw(data["password"].encode(),Accounts["salt"].encode())):
            del csrfData[csrf]
            return {"token": Accounts[data["login"]]["token"], "uid": Accounts[data["login"]]["uid"]}
        else:
            return {"token": "none", "uid": "none"}
    except Exception as e:
        return {"token": "none", "uid": "none"}

csrfData = {}
@user_bp.route("/", methods=['GET'])
def Home():
    try:
        if allowed(request):
            return redirect("/user", code=302)
    except:
        pass

    csrf = uuid.uuid4().hex
    csrfData[csrf] = {
        "ua": request.headers.get("User-Agent"),
        "unix": int(time.time())
    }
    return render_template("/login/login.html", title="Auth", csrf=csrf, date=datetime.datetime.now())

@user_bp.route("/set/wallpaper",methods=["POST"])
def setWallpaper():
    global Accounts
    login = request.cookies.getlist('login')[0]
    uid = request.cookies.getlist('uid')[0]
    data = request.get_json()

    if data["file"]:
        if allowed(request):
            Accounts[login]["wallpaper"] = f"accounts/{uid}/{data['file']}"
            updateJson()
            return "OK"
        else:
            return make_response(jsonify({"error": "Unauthorized"}), 401)
    else:
        return make_response(jsonify({"error": "File name expected"}), 403)

def csrfExpiryCheck():
    while True:
        try:
            time.sleep(30)
            tempToDelete = []
            for x in csrfData:
                handle = csrfData[x]
                if (int(time.time())-handle["unix"]) >= 600:
                    tempToDelete.append(x)
            
            for x in tempToDelete:
                del csrfData[x]
        except:
            pass

threading.Thread(target=csrfExpiryCheck, args=()).start()
