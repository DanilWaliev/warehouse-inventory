package main

import (
	"path/filepath"
	"text/template"
)

// Создает и возвращает карту кеша для шаблонов страниц
func newTemplateCache(dir string) (map[string]*template.Template, error) {
	// Карта, которая хранит кеш
	cache := map[string]*template.Template{}

	// Получаем все шаблоны страниц
	pages, err := filepath.Glob(filepath.Join(dir, "pages/*.page.tmpl"))

	if err != nil {
		return nil, err
	}

	// Перебираем каждую страницу
	for _, page := range pages {
		// Получаем имя, чтобы установить его как ключ для элемента карты
		name := filepath.Base(page)

		// Обрабатываем перебираемую страницу
		ts, err := template.ParseFiles(page)

		if err != nil {
			return nil, err
		}

		// Обрабатываем все шаблоны-макеты, ассоциированные с перебираемым шаблоном страницы
		ts, err = ts.ParseGlob(filepath.Join(dir, "*.layout.tmpl"))
		if err != nil {
			return nil, err
		}

		// Обрабатываем все шаблоны-части, ассоциированные с перебираемым шаблоном страницы
		ts, err = ts.ParseGlob(filepath.Join(dir, "*.partial.tmpl"))
		if err != nil {
			return nil, err
		}

		cache[name] = ts
	}

	return cache, nil
}
