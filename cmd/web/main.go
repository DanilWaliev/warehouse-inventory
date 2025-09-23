package main

import (
	"database/sql"
	"flag"
	"log"
	"net/http"
	"os"
	"text/template"
	"warehouse-inventory/pkg/handlers"
	"warehouse-inventory/pkg/handlers/api"
	"warehouse-inventory/pkg/handlers/auth"
	"warehouse-inventory/pkg/handlers/pages"
	"warehouse-inventory/pkg/models/mysql"
	"warehouse-inventory/pkg/services"

	_ "github.com/go-sql-driver/mysql"
)

type application struct {
	errorLog      *log.Logger
	infolog       *log.Logger
	JWTkey        []byte
	templateCache map[string]*template.Template

	pageHandler *pages.PageHandler
	apiHandler  *api.APIHandler
	authHandler *auth.AuthHandler
}

func newApplication(
	errorLog, infoLog *log.Logger,
	JWTkey []byte,
	templateCache map[string]*template.Template,
	db *sql.DB) *application {
	// Модели
	models := mysql.NewMySQLModels(db)

	// Сервисы
	services := services.NewServices(models)

	// Хелпер, рендерер
	helper := handlers.NewLogHelper(errorLog)
	renderer := handlers.NewRenderer(templateCache)

	// Обработчики
	apiHandler := api.NewAPIHandler(helper, services)
	pageHandler := pages.NewPageHandler(renderer, helper)
	authHandler := auth.NewAuthHandler(JWTkey, helper, renderer, services.UserService)

	return &application{
		errorLog:      errorLog,
		infolog:       infoLog,
		JWTkey:        JWTkey,
		templateCache: templateCache,

		apiHandler:  apiHandler,
		pageHandler: pageHandler,
		authHandler: authHandler,
	}
}

func main() {
	addr := flag.String("addr", "localhost:4000", "Адрес сервера")
	dsn := flag.String("dsn", "web:pass@/warehouse-inventory?parseTime=true", "Строка подключения к БД")

	// Создаем логеры
	infoLog := log.New(os.Stdout, "INFO\t", log.Ldate|log.Ltime)
	errorLog := log.New(os.Stderr, "ERROR\t", log.Ldate|log.Ltime|log.Llongfile)

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
	JWTkey := []byte("super secret key") // TODO: Убрать временную заглушку

	app := newApplication(errorLog, infoLog, JWTkey, templateCache, db)

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
