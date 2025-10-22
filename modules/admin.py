from globals import *

admin_bp = Blueprint('admin', __name__)

@admin_bp.route('/users', methods=['GET'])
def getUsers():
    if allowed(request, "admin"):
        users_list = []
        for x in Accounts:
            if Accounts[x]["hidden"] != "1":
                users_list.append(
                    [
                        Accounts[x]["uid"],
                        x,
                        Accounts[x]["id"],
                         Accounts[x]["created_at"]
                    ]
                )

        return users_list
    else:
        return make_response(jsonify({"error": "Unauthorized"}), 401)
    
@admin_bp.route('/user/<uid>', methods=['GET'])
def getUserByUID(uid):
    if allowed(request, "admin"):
        for x in Accounts:
            if Accounts[x]["uid"] == uid:
                return Accounts[x]
        return "Error"
    else:
        return make_response(jsonify({"error": "Unauthorized"}), 401)
    
@admin_bp.route('/user/delete/<name>', methods=['GET'])
def deleteUser(name):
    if allowed(request, "admin"):
        shutil.rmtree(f"accounts/{Accounts[name]['uid']}")

        del Accounts[name]
        updateJson()
        return "Ok"
    else:
        return make_response(jsonify({"error": "Unauthorized"}), 401)
    
@admin_bp.route('/user/mod/<name>', methods=['POST'])
def modUser(name):
    if allowed(request, "admin"):
        Accounts[name] = request.get_json()
        updateJson()
        return "Ok"
    else:
        return make_response(jsonify({"error": "Unauthorized"}), 401)