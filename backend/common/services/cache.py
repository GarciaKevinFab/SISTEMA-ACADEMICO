from django.core.cache import cache

def cache_set(key: str, value, timeout=60):
    cache.set(key, value, timeout)

def cache_get(key: str):
    return cache.get(key)

def cache_delete(key: str):
    cache.delete(key)
