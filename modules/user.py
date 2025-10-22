from globals import *

user_bp = Blueprint('user', __name__)

##[REGISTER]##
def RegisterUser(username,password):
    uid = ''.join(random.choice(string.ascii_letters) for i in range(8))
    token = ''.join(random.choice(string.ascii_letters) for i in range(64))
    Accounts[username] = {
        "username": username,
        "password": f'{bcrypt.hashpw(password.encode(), b"$2b$12$BfgXYoiUENZovKzwqYy48OMPRG9kIhc7Kt07DBcQQcmExk/oUZxHi")}',
        "created_at": datetime.datetime.today().strftime('%Y-%m-%d %H:%M'),
        "uid": uid,
        "token": token,
        "files": [],
        "wallpaper": "static/default.jpg"
    }
    updateJson()
    os.mkdir(f"accounts/{uid}")
    
    print("Succesfuly created account")

##[LOGIN]##
tempLoginSecurity = {}
@user_bp.route("/", methods=['GET'])
def Home():
    try:
        if allowed(request):
            return redirect("/user", code=302)
    except:
        pass
    key = ''.join(random.choice(string.ascii_letters) for i in range(8))
    solution = random.randint(1,999)
    tempLoginSecurity[key] = {
        "solution": solution,
        "unix": int(time.time())
    }
    return render_template("/login/login.html", title="cvel", key=key, solution=solution, date=datetime.datetime.now())

def loginKeysExpiryCheck():
    while True:
        try:
            time.sleep(25)
            tempToDelete = []
            for x in tempLoginSecurity:
                handle = tempLoginSecurity[x]
                if (int(time.time())-handle["unix"]) >= 900:
                    tempToDelete.append(x)
            
            for x in tempToDelete:
                del tempLoginSecurity[x]
        except:
            pass

#threading.Thread(target=loginKeysExpiryCheck, args=()).start()

@user_bp.route("/login", methods=['POST'])
def Login():
    try:
        data = request.get_json()
        if str(Accounts[data["login"]]["password"]) == str(bcrypt.hashpw(data["password"].encode(), b"$2b$12$BfgXYoiUENZovKzwqYy48OMPRG9kIhc7Kt07DBcQQcmExk/oUZxHi")) and int(tempLoginSecurity[data["key"]]["solution"])-1 == int(data["solution"]):
            del tempLoginSecurity[data["key"]] # Valid only once
            return {"token": Accounts[data["login"]]["token"], "uid": Accounts[data["login"]]["uid"]}
        else:
            return {"token": "none", "uid": "none"}
    except Exception as e:
        return {"token": "none", "uid": "none"}

@user_bp.route("/set/wallpaper",methods=["POST"])
def setWallpaper():
    global Accounts
    login = request.cookies.getlist('login')[0]
    token = request.cookies.getlist('token')[0]
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