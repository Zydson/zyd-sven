from globals import *

errors_bp = Blueprint('errors', __name__)

errors = {
    "400": "bad request",
    "401": "unauthorized",
    "403": "forbidden",
    "404": "page not found",
    "405": "method not allowed",
    "414": "uri is too long",
    "415": "unsupported media type",
    "429": "you're currently being rate limited",

    "500": "internal server error",
    "502": "bad gateway",
    "503": "service unavailable - try again later",
    "504": "timeout",
    "505": "http version not supported"
}

@errors_bp.app_errorhandler(Exception)
def notFound(e):
    status_code = getattr(e, 'code', 500)
    err_info = "unknown"
    try:
        err_info = errors[str(status_code)]
    except:
        pass

    return render_template('error.html', code=status_code, err=err_info), status_code