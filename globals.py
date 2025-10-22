import json, bcrypt, random, string, time, os, datetime, threading, subprocess, psutil, requests, shutil, hashlib, zipfile, rarfile, tarfile
from flask import Flask, render_template, send_file, request, send_from_directory, redirect, Blueprint, current_app, jsonify, make_response

from werkzeug.exceptions import RequestEntityTooLarge
from werkzeug.datastructures import ImmutableMultiDict # Cookies handle
from werkzeug.utils import secure_filename

accJson = open('accounts/accounts.json','r+')
Accounts = json.load(accJson)

def allowed(req):
    try:
        if req.cookies.getlist('token')[0] == Accounts[req.cookies.getlist('login')[0]]["token"]:
            return 1
        else:
            return 0
    except:
        return 0

def updateJson():
    global Accounts
    tempAccounts = Accounts.copy()
    json.dump(tempAccounts, open('accounts/accounts.json','w+'), indent = 4)


__all__ = ['json', 'bcrypt', 'random', 'string', 'time', 'os', 'datetime', 'threading', 'subprocess', 'hashlib', 'psutil', 'shutil', 'updateJson', 'Accounts', 'requests', 'RequestEntityTooLarge', 'ImmutableMultiDict', 'secure_filename', 'Flask', 'render_template', 'send_file', 'request', 'send_from_directory', 'redirect', 'Blueprint', 'current_app', 'allowed', 'jsonify', 'make_response', 'zipfile', 'rarfile', 'tarfile']