package main

import (
	"database/sql"
	"flag"
	"log"
	"net/http"
	"os"
	"text/template"
	"warehouse-inventory/pkg/handlers/api"
	"warehouse-inventory/pkg/handlers/pages"
	"warehouse-inventory/pkg/models/mysql"

	_ "github.com/go-sql-driver/mysql"
)

type application struct {
	errorLog      *log.Logger
	infolog       *log.Logger
	JWTkey        []byte
	templateCache map[string]*template.Template
	models        *mysql.MySQLModels

	pageHandler pages.PageHandler
	apiHandler  api.APIHandler
}

func newApplication(
	errorLog, infoLog *log.Logger,
	JWTkey []byte,
	templateCache map[string]*template.Template,
	models *mysql.MySQLModels,
	pageHandler pages.PageHandler,
	apiHandler api.APIHandler) *application {
	pageHandler := 
}

func main() {
	addr := flag.String("addr", "localhost:4000", "Адрес сервера")
	dsn := flag.String("dsn", "web:pass@/warehouse-inventory?parseTime=true", "Строка подключения к БД")

	// Создаем логеры
	infoLog := log.New(os.Stdout, "INFO\t", log.Ldate|log.Ltime)
	errorLog := log.New(os.Stderr, "ERROR\t", log.Ldate|log.Ltime|log.Lshortfile)

	// Подключение к БД
	db, err := openDB(*dsn)
	if err != nil {
		errorLog.Fatal(err)
	}

	// Создаем карту кеша страниц
	templateCache, err := newTemplateCache("./ui/html")
	if err != nil {
		errorLog.Fatal(err)
	}

	// Инициализируем структуру приложения с нужными зависимостями
	app := &application{
		errorLog:      errorLog,
		infolog:       infoLog,
		templateCache: templateCache,
		models:        mysql.NewMySQLModels(db),
		JWTkey:        []byte("super secret key"), // TODO: убрать временную заглушку
	}

	// Инициализация структуры сервера
	srv := &http.Server{
		Addr:     *addr,
		ErrorLog: app.errorLog,
		Handler:  app.routes(),
	}

	// Запуск сервера
	infoLog.Printf("Запуск сервера на %s", *addr)
	err = srv.ListenAndServe()
	errorLog.Fatal(err)
}

// Подключение к БД
func openDB(dsn string) (*sql.DB, error) {
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return nil, err
	}
	if err = db.Ping(); err != nil {
		return nil, err
	}
	return db, err
}
