import os
from flask import Flask
from modules.user import user_bp
from modules.ui import ui_bp
from modules.notepad import notepad_bp
from modules.admin import admin_bp
from modules.errors import errors_bp
from modules.files import files_bp
from globals import MAX_CONTENT_LENGTH

app = Flask("rb",static_folder=None)
app.template_folder = "html"
app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH
app.config['UPLOAD_FOLDER'] = os.path.join(os.getcwd(), 'accounts')
app.config["TEMPLATES_AUTO_RELOAD"] = True

app.register_blueprint(ui_bp)
app.register_blueprint(errors_bp)
app.register_blueprint(user_bp)
app.register_blueprint(files_bp, url_prefix="/files")
app.register_blueprint(notepad_bp, url_prefix='/notepad')
app.register_blueprint(admin_bp, url_prefix='/admin')

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=888, threaded=True)
