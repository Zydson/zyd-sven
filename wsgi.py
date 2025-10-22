from main import app

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=443, threaded=True, ssl_context=('/etc/letsencrypt/live/cwel.tv/fullchain.pem', '/etc/letsencrypt/live/cwel.tv/privkey.pem'))
