package main

import "net/http"

func (app *application) routes() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("/", app.root)
	mux.HandleFunc("/signin", app.signIn)
	mux.HandleFunc("/signup", app.signUp)
	mux.HandleFunc("/signout", app.signOut)
	mux.HandleFunc("/production", app.production)
	//mux.HandleFunc("/production/tmc", app.createTMC)

	fileServer := http.FileServer(http.Dir("./ui/static"))
	mux.Handle("/static/", http.StripPrefix("/static", fileServer))

	return mux
}
