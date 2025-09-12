package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"warehouse-inventory/pkg/sqlerr"
)

/* Файл содержит обработчики для запросов к API (получение, удаление, изменение данных) из отображаемой страницы */

func (app *application) ShowAllTMC(w http.ResponseWriter, r *http.Request) {

	// Получаем список всех компонентов (ТМЦ) из БД
	components, err := app.models.ComponentModel.GetAll()
	if err != nil {
		app.serverError(w, err)
	}

	// Кодириуем в JSON и отправляем
	w.Header().Set("Conent-Type", "application/json")
	err = json.NewEncoder(w).Encode(components)
	if err != nil {
		app.serverError(w, err)
	}
}

func (app *application) ShowTMC(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", http.MethodPost)
		app.clientError(w, http.StatusMethodNotAllowed)
		return
	}

	// Авторизация
	if role, err := app.auth(r); role != "admin" && role != "productionmanager" {
		app.clientError(w, http.StatusUnauthorized)
		return
	} else if err != nil {
		app.serverError(w, err)
		return
	}

	// Структура, чтобы считать туда ID ТМЦ для отправления
	var jsonID struct {
		ID int `json:"id"`
	}

	// Декодируем JSON
	err := json.NewDecoder(r.Body).Decode(&jsonID)
	if err != nil {
		app.serverError(w, err)
		return
	}

	// Получаем из БД ТМЦ с полученным от пользователя id и отправляем
	component, err := app.models.ComponentModel.GetByID(jsonID.ID)
	if err != nil {
		app.serverError(w, err)
	}

	// Кодириуем в JSON и отправляем
	w.Header().Set("Conent-Type", "application/json")
	err = json.NewEncoder(w).Encode(component)
	if err != nil {
		app.serverError(w, err)
	}
}

func (app *application) CreateTMC(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", http.MethodPost)
		app.clientError(w, http.StatusMethodNotAllowed)
		return
	}

	// Авторизация
	if role, err := app.auth(r); role != "admin" && role != "productionmanager" {
		app.clientError(w, http.StatusUnauthorized)
		return
	} else if err != nil {
		app.serverError(w, err)
		return
	}

	// Структура для получения данных из запроса (используются структурные теги)
	var newTMC struct {
		Name    string `json:"name"`
		Weight  string `json:"weight"`
		TMCtype string `json:"type"`
		Note    string `json:"note"`
	}

	// Декодируем полученный JSON в созданную структуру
	err := json.NewDecoder(r.Body).Decode(&newTMC)
	if err != nil {
		app.serverError(w, err)
		return
	}

	// Приводим строку к числу с плаващей точкой (вес компонента, ТМЦ)
	weight, err := strconv.ParseFloat(newTMC.Weight, 64)
	if err != nil {
		app.serverError(w, err)
		return
	}

	// Вставляем данные в таблицу
	err = app.models.ComponentModel.Insert(newTMC.Name, weight, newTMC.TMCtype, newTMC.Note)
	if err != nil {
		if sqlerr.Is(err, sqlerr.ErrDuplicateEntry) {
			app.clientError(w, http.StatusConflict)
		} else if sqlerr.Is(err, sqlerr.ErrCheckConstraint) {
			app.clientError(w, http.StatusBadRequest)
		} else {
			app.serverError(w, err)
			fmt.Printf("%+v", err)
		}
	}
}

func (app *application) DeleteTMC(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", http.MethodPost)
		app.clientError(w, http.StatusMethodNotAllowed)
		return
	}

	// Авторизация
	if role, err := app.auth(r); role != "admin" && role != "productionmanager" {
		app.clientError(w, http.StatusUnauthorized)
		return
	} else if err != nil {
		app.serverError(w, err)
		return
	}

	// Структура, чтобы считать туда ID ТМЦ для удаления
	var jsonID struct {
		ID int `json:"id"`
	}

	// Декодируем JSON
	err := json.NewDecoder(r.Body).Decode(&jsonID)
	if err != nil {
		app.serverError(w, err)
		return
	}

	// Удаляем ТМЦ с полученным id
	err = app.models.ComponentModel.DeleteByID(jsonID.ID)
	if err != nil {
		app.serverError(w, err)
	}
}

func (app *application) EditTMC(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", http.MethodPost)
		app.clientError(w, http.StatusMethodNotAllowed)
		return
	}

	// Авторизация
	if role, err := app.auth(r); role != "admin" && role != "productionmanager" {
		app.clientError(w, http.StatusUnauthorized)
		return
	} else if err != nil {
		app.serverError(w, err)
		return
	}

	// Структура для получения данных из запроса (используются структурные теги)
	var newTMC struct {
		ID      int    `json:"id"`
		Name    string `json:"name"`
		Weight  string `json:"weight"`
		TMCtype string `json:"type"`
		Note    string `json:"note"`
	}

	// Декодируем полученный JSON в созданную структуру
	err := json.NewDecoder(r.Body).Decode(&newTMC)
	if err != nil {
		app.serverError(w, err)
		return
	}

	// Приводим строку к числу с плаващей точкой (вес компонента, ТМЦ)
	weight, err := strconv.ParseFloat(newTMC.Weight, 64)
	if err != nil {
		app.serverError(w, err)
		return
	}

	// Обновляем данные в таблице
	err = app.models.ComponentModel.Update(newTMC.ID, newTMC.Name, weight, newTMC.TMCtype, newTMC.Note)
	if err != nil {
		if sqlerr.Is(err, sqlerr.ErrDuplicateEntry) {
			app.clientError(w, http.StatusConflict)
		} else if sqlerr.Is(err, sqlerr.ErrCheckConstraint) {
			app.clientError(w, http.StatusBadRequest)
		} else {
			app.serverError(w, err)
			fmt.Printf("%+v", err)
		}
	}
}
