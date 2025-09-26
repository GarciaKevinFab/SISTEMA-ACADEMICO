import os
from pymongo import MongoClient
from django.conf import settings

_MONGO = None

def get_mongo():
    global _MONGO
    if _MONGO is None:
        url = os.getenv('MONGO_URL')
        dbname = os.getenv('DB_NAME','sistemaacademico')
        if not url:
            raise RuntimeError('MONGO_URL no configurado')
        client = MongoClient(url, tlsAllowInvalidCertificates=True)
        _MONGO = client[dbname]
    return _MONGO
