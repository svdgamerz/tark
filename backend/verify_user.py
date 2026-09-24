from app.config.db_path import get_db_path
from app.auth.store import UserStore

store = UserStore()
print("Using db path:", get_db_path("tark.db"))
u = store.get_by_email("svdgamerz3@gmail.com")
print("Before:", u)
if u:
    store.mark_verified("svdgamerz3@gmail.com")
    print("After:", store.get_by_email("svdgamerz3@gmail.com"))
else:
    print("User not found by UserStore")
