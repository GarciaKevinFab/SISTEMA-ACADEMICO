import re

_placeholder_re = re.compile(r"\{\{\s*([\w.]+)\s*\}\}")

def get_in(data, path):
    cur = data
    for p in path.split('.'):
        if cur is None: return ""
        cur = cur.get(p) if isinstance(cur, dict) else getattr(cur, p, "")
    return cur if cur is not None else ""

def render_template(tpl: dict, data: dict, channel: str):
    """tpl: dict con campos de plantilla; data: variables; channel: EMAIL|SMS|IN_APP"""
    def repl(s):
        if not s: return ""
        return _placeholder_re.sub(lambda m: str(get_in(data, m.group(1)) or ""), s)

    out = {}
    if channel == "EMAIL":
        out["subject"] = repl(tpl.get("email_subject",""))
        out["html"] = repl(tpl.get("email_html",""))
    elif channel == "SMS":
        out["text"] = repl(tpl.get("sms_text",""))
    elif channel == "IN_APP":
        out["text"] = repl(tpl.get("in_app_text",""))
    return out
