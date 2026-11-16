"""PythonAnywhere WSGI 配置：计算器在根路径，书评站在 /book。

用法：备份原 WSGI 文件后，把本文件内容复制到
/var/www/77icc_pythonanywhere_com_wsgi.py
"""

import sys

from werkzeug.middleware.dispatcher import DispatcherMiddleware

CALC_PATH = "/home/77icc/calculator-backend"
BOOK_PATH = "/home/77icc/book-site/backend"

for path in (CALC_PATH, BOOK_PATH):
    if path not in sys.path:
        sys.path.append(path)

from main import app as calc_app  # noqa: E402  计算器后端入口
from book_app import app as book_app  # noqa: E402  书评站后端入口

application = DispatcherMiddleware(calc_app, {"/book": book_app})
