package main

import "net/http"

func (app *application) routes() *http.ServeMux {
	mux := http.NewServeMux()
	// Запросы к связанные с auth
	mux.HandleFunc("/", app.authHandler.RequireAuth(app.pageHandler.Root))
	mux.HandleFunc("/signin", app.authHandler.SignIn)
	mux.HandleFunc("/signup", app.authHandler.SignUp)
	mux.HandleFunc("/signout", app.authHandler.SignOut)

	mux.HandleFunc("/production", app.authHandler.AccessWithRoles(app.pageHandler.Production, "admin", "productionmanager"))

	// // Запросы к API
	mux.HandleFunc("/api/tmc", app.apiHandler.Component)

	fileServer := http.FileServer(http.Dir("./ui/static"))
	mux.Handle("/static/", http.StripPrefix("/static", fileServer))

	return mux
}
