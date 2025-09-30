package api

import (
	"net/http"
	"strings"
	"warehouse-inventory/pkg/handlers"
	"warehouse-inventory/pkg/services"
)

/* Обработчики запросов к API. Обработчики в зависимости от HTTP-метода вызывают методы соответствующих структур */

type APIHandler struct {
	Helper           *handlers.LogHelper
	ComponentHandler *ComponentHandler
	RecipeHandler    *RecipeHandler
	UserHandler      *UserHandler
	OrderHandler     *OrderHandler
	StorageHandler   *StorageHandler
}

func NewAPIHandler(helper *handlers.LogHelper, services *services.Services) *APIHandler {
	return &APIHandler{
		Helper:           helper,
		ComponentHandler: NewComponentHandler(helper, services.ComponentService),
		RecipeHandler:    NewRecipeHandler(helper, services.RecipeService),
		UserHandler:      NewUserHandler(helper, services.UserService),
		OrderHandler:     NewOrderHandler(helper, services.OrderService),
		StorageHandler:   NewStorageHandler(helper, services.StorageService),
	}
}

func (h *APIHandler) Component(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.ComponentHandler.Get(w, r)
	case http.MethodPost:
		h.ComponentHandler.Post(w, r)
	case http.MethodPut:
		h.ComponentHandler.Put(w, r)
	case http.MethodDelete:
		h.ComponentHandler.Delete(w, r)
	default:
		w.Header().Set("Allow", strings.Join([]string{
			http.MethodPost,
			http.MethodGet,
			http.MethodPut,
			http.MethodDelete,
		}, ", "))

		h.Helper.ClientError(w, http.StatusMethodNotAllowed)
	}
}

func (h *APIHandler) User(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		//
	case http.MethodPost:
		//
	case http.MethodPut:
		//
	case http.MethodDelete:
	//
	default:
		w.Header().Set("Allow", strings.Join([]string{
			http.MethodPost,
			http.MethodGet,
			http.MethodPut,
			http.MethodDelete,
		}, ", "))

		h.Helper.ClientError(w, http.StatusMethodNotAllowed)
	}
}

func (h *APIHandler) Recipe(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.RecipeHandler.Get(w, r)
	case http.MethodPost:
		h.RecipeHandler.Post(w, r)
	case http.MethodPut:
		h.RecipeHandler.Put(w, r)
	case http.MethodDelete:
		h.RecipeHandler.Delete(w, r)
	default:
		w.Header().Set("Allow", strings.Join([]string{
			http.MethodPost,
			http.MethodGet,
			http.MethodPut,
			http.MethodDelete,
		}, ", "))

		h.Helper.ClientError(w, http.StatusMethodNotAllowed)
	}
}

func (h *APIHandler) Order(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.OrderHandler.Get(w, r)
	case http.MethodPost:
		h.OrderHandler.Post(w, r)
	case http.MethodPut:
		h.OrderHandler.Put(w, r)
	case http.MethodDelete:
		h.OrderHandler.Delete(w, r)
	default:
		w.Header().Set("Allow", strings.Join([]string{
			http.MethodPost,
			http.MethodGet,
			http.MethodPut,
			http.MethodDelete,
		}, ", "))
	}
}

func (h *APIHandler) Storage(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.StorageHandler.Get(w, r)
	case http.MethodPost:
		h.StorageHandler.Post(w, r)
	case http.MethodPut:
		//
	case http.MethodDelete:
		//
	default:
		w.Header().Set("Allow", strings.Join([]string{
			http.MethodPost,
			http.MethodGet,
			http.MethodPut,
			http.MethodDelete,
		}, ", "))
	}
}

/* Файл содержит обработчики для запросов к API (получение, удаление, изменение данных) из отображаемой страницы */

// func (h *APIHandler) GetByType(w http.ResponseWriter, r *http.Request) {

// 	// Получаем список всех компонентов (ТМЦ) из БД
// 	componentType := r.URL.Query().Get("type")

// 	var components []*models.Component
// 	var err error
// 	if componentType == "all" {
// 		components, err = h.models.ComponentModel.GetAll()
// 	} else {
// 		components, err = h.models.ComponentModel.GetByType(componentType)
// 	}

// 	if err != nil {
// 		h.serverError(w, err)
// 	}

// 	// Кодириуем в JSON и отправляем
// 	w.Header().Set("Conent-Type", "application/json")
// 	err = json.NewEncoder(w).Encode(components)
// 	if err != nil {
// 		app.serverError(w, err)
// 	}
// }

// func (h *APIHandler) GetTMCByID(w http.ResponseWriter, r *http.Request) {
// 	if r.Method != http.MethodPost {
// 		w.Header().Set("Allow", http.MethodPost)
// 		app.clientError(w, http.StatusMethodNotAllowed)
// 		return
// 	}

// 	// Структура, чтобы считать туда ID ТМЦ для отправления
// 	var jsonID struct {
// 		ID int `json:"id"`
// 	}

// 	// Декодируем JSON
// 	err := json.NewDecoder(r.Body).Decode(&jsonID)
// 	if err != nil {
// 		app.serverError(w, err)
// 		return
// 	}

// 	// Получаем из БД ТМЦ с полученным от пользователя id и отправляем
// 	component, err := app.models.ComponentModel.GetByID(jsonID.ID)
// 	if err != nil {
// 		app.serverError(w, err)
// 	}

// 	// Кодириуем в JSON и отправляем
// 	w.Header().Set("Conent-Type", "application/json")
// 	err = json.NewEncoder(w).Encode(component)
// 	if err != nil {
// 		app.serverError(w, err)
// 	}
// }

// func (h *APIHandler) CreateTMC(w http.ResponseWriter, r *http.Request) {
// 	if r.Method != http.MethodPost {
// 		w.Header().Set("Allow", http.MethodPost)
// 		app.clientError(w, http.StatusMethodNotAllowed)
// 		return
// 	}

// 	// Структура для получения данных из запроса (используются структурные теги)
// 	var newTMC struct {
// 		Name    string `json:"name"`
// 		Weight  string `json:"weight"`
// 		TMCtype string `json:"type"`
// 		Note    string `json:"note"`
// 	}

// 	// Декодируем полученный JSON в созданную структуру
// 	err := json.NewDecoder(r.Body).Decode(&newTMC)
// 	if err != nil {
// 		app.serverError(w, err)
// 		return
// 	}

// 	// Приводим строку к числу с плаващей точкой (вес компонента, ТМЦ)
// 	weight, err := strconv.ParseFloat(newTMC.Weight, 64)
// 	if err != nil {
// 		app.serverError(w, err)
// 		return
// 	}

// 	// Вставляем данные в таблицу
// 	err = app.models.ComponentModel.Insert(newTMC.Name, weight, newTMC.TMCtype, newTMC.Note)
// 	if err != nil {
// 		if sqlerr.Is(err, sqlerr.ErrDuplicateEntry) {
// 			app.clientError(w, http.StatusConflict)
// 		} else if sqlerr.Is(err, sqlerr.ErrCheckConstraint) {
// 			app.clientError(w, http.StatusBadRequest)
// 		} else {
// 			app.serverError(w, err)
// 			fmt.Printf("%+v", err)
// 		}
// 	}
// }

// func (h *APIHandler) DeleteTMC(w http.ResponseWriter, r *http.Request) {
// 	if r.Method != http.MethodPost {
// 		w.Header().Set("Allow", http.MethodPost)
// 		app.clientError(w, http.StatusMethodNotAllowed)
// 		return
// 	}

// 	// Структура, чтобы считать туда ID ТМЦ для удаления
// 	var jsonID struct {
// 		ID int `json:"id"`
// 	}

// 	// Декодируем JSON
// 	err := json.NewDecoder(r.Body).Decode(&jsonID)
// 	if err != nil {
// 		app.serverError(w, err)
// 		return
// 	}

// 	// Удаляем ТМЦ с полученным id
// 	err = app.models.ComponentModel.DeleteByID(jsonID.ID)
// 	if err != nil {
// 		app.serverError(w, err)
// 	}
// }

// func (app *application) EditTMC(w http.ResponseWriter, r *http.Request) {
// 	if r.Method != http.MethodPost {
// 		w.Header().Set("Allow", http.MethodPost)
// 		app.clientError(w, http.StatusMethodNotAllowed)
// 		return
// 	}

// 	// Структура для получения данных из запроса (используются структурные теги)
// 	var newTMC struct {
// 		ID      int    `json:"id"`
// 		Name    string `json:"name"`
// 		Weight  string `json:"weight"`
// 		TMCtype string `json:"type"`
// 		Note    string `json:"note"`
// 	}

// 	// Декодируем полученный JSON в созданную структуру
// 	err := json.NewDecoder(r.Body).Decode(&newTMC)
// 	if err != nil {
// 		app.serverError(w, err)
// 		return
// 	}

// 	// Приводим строку к числу с плаващей точкой (вес компонента, ТМЦ)
// 	weight, err := strconv.ParseFloat(newTMC.Weight, 64)
// 	if err != nil {
// 		app.serverError(w, err)
// 		return
// 	}

// 	// Обновляем данные в таблице
// 	err = app.models.ComponentModel.Update(newTMC.ID, newTMC.Name, weight, newTMC.TMCtype, newTMC.Note)
// 	if err != nil {
// 		if sqlerr.Is(err, sqlerr.ErrDuplicateEntry) {
// 			app.clientError(w, http.StatusConflict)
// 		} else if sqlerr.Is(err, sqlerr.ErrCheckConstraint) {
// 			app.clientError(w, http.StatusBadRequest)
// 		} else {
// 			app.serverError(w, err)
// 			fmt.Printf("%+v", err)
// 		}
// 	}
// }
