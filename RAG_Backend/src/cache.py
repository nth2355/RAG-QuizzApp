"""Bounded, expiring in-process caches; callers never share mutable results."""
from collections import OrderedDict
from copy import deepcopy
from threading import RLock
from time import monotonic

class ResultCache:
    def __init__(self, maxsize=32, ttl=900):
        self.maxsize, self.ttl = maxsize, ttl
        self._items = OrderedDict()
        self._lock = RLock()

    def get(self, key):
        with self._lock:
            item = self._items.get(key)
            if item is None:
                return None
            expires, value = item
            if expires <= monotonic():
                del self._items[key]
                return None
            self._items.move_to_end(key)
            return deepcopy(value)

    def __setitem__(self, key, value):
        with self._lock:
            self._items[key] = (monotonic() + self.ttl, deepcopy(value))
            self._items.move_to_end(key)
            while len(self._items) > self.maxsize:
                self._items.popitem(last=False)

    def clear(self):
        with self._lock:
            self._items.clear()

summary_cache = ResultCache()
quiz_cache = ResultCache()
flashcard_cache = ResultCache()

def clear_learning_caches():
    for cache in (summary_cache, quiz_cache, flashcard_cache):
        cache.clear()
