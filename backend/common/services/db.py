from django.db import connection

def run_raw_query(query: str, params=None):
    """
    Ejecuta una query SQL cruda y devuelve resultados.
    Úsalo con cuidado.
    """
    with connection.cursor() as cursor:
        cursor.execute(query, params or [])
        columns = [col[0] for col in cursor.description]
        return [dict(zip(columns, row)) for row in cursor.fetchall()]
