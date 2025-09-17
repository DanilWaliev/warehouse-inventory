package handlers

import (
	"fmt"
	"log"
	"net/http"
	"runtime/debug"
	"text/template"
)

/* В файле вспомогательные функции для обработчиков */

// Структура для получения логгера ошибок и использовании его в обработчике
type AppLogger struct {
	errorLog *log.Logger
}

// Структура для получения карты кеша шаблонов и рендера страниц
type Renderer struct {
	cache map[string]*template.Template
}

// Отправляет Internal Server Error и логирует ошибку
func (l *AppLogger) ServerError(w http.ResponseWriter, err error) {
	trace := fmt.Sprintf("%s\n%s", err.Error(), debug.Stack())
	l.errorLog.Output(2, trace)

	http.Error(w, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
}

// Отправляет ошибку с указанным статусом
func (l *AppLogger) ClientError(w http.ResponseWriter, status int) {
	http.Error(w, http.StatusText(status), status)
}

// Обертка ClientError для отправки статуса Not Found
func (l *AppLogger) NotFound(w http.ResponseWriter) {
	l.ClientError(w, http.StatusNotFound)
}

func (r *Renderer) Render(w http.ResponseWriter, name string, templateData any) error {
	// Получаем шаблон
	ts, ok := r.cache[name]
	if !ok {
		return fmt.Errorf("шаблона %s не существует", name)
	}

	// Рендер
	err := ts.Execute(w, templateData)
	if err != nil {
		return err
	}

	return nil
}
