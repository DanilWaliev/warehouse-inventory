package main

import "net/http"

func (app *application) routes() *http.ServeMux {
	mux := http.NewServeMux()
	// Запросы к связанные с auth
	mux.HandleFunc("/", app.authHandler.RequireAuth(app.pageHandler.Root))
	mux.HandleFunc("/signin", app.authHandler.SignIn)
	mux.HandleFunc("/signup", app.authHandler.SignUp)
	mux.HandleFunc("/signout", app.authHandler.SignOut)

	// Страницы
	mux.HandleFunc("/production", app.authHandler.AccessWithRoles(app.pageHandler.Production, "admin", "prod_manager"))
	mux.HandleFunc("/movement", app.authHandler.AccessWithRoles(app.pageHandler.Movement, "admin", "logistics"))
	mux.HandleFunc("/inventory", app.authHandler.AccessWithRoles(app.pageHandler.Inventory, "admin", "storekeeper"))

	// Запросы к API
	mux.HandleFunc("/api/tmc", app.authHandler.AccessWithRoles(app.apiHandler.Component, "admin", "prod_manager"))
	mux.HandleFunc("/api/recipe", app.authHandler.AccessWithRoles(app.apiHandler.Recipe, "admin", "prod_manager"))
	mux.HandleFunc("/api/order", app.authHandler.AccessWithRoles(app.apiHandler.Order, "admin", "prod_manager"))
	mux.HandleFunc("/api/storage", app.authHandler.AccessWithRoles(app.apiHandler.Storage, "admin", "logistics"))
	mux.HandleFunc("/api/document", app.authHandler.AccessWithRoles(app.apiHandler.Document, "admin", "logistics"))
	//mux.HandleFunc("/api/route", app.authHandler.AccessWithRoles(app.apiHandler.Route))

	fileServer := http.FileServer(http.Dir("./ui/static"))
	mux.Handle("/static/", http.StripPrefix("/static", fileServer))

	return mux
}
