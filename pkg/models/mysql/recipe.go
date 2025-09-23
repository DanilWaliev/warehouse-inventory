package mysql

import (
	"database/sql"
	"errors"
	"warehouse-inventory/pkg/models"
)

type RecipeModel struct {
	DB *sql.DB
}

func NewRecipeModel(db *sql.DB) *RecipeModel {
	return &RecipeModel{
		DB: db,
	}
}

func (m *RecipeModel) SelectByID(id int) (*models.Recipe, error) {
	// Получаем результирующий компонент
	stmt := `SELECT c.Component_ID, c.Name, c.Weight, r.Type, c.Note
	FROM recipe r
	JOIN component c ON r.Component_ID = c.Component_ID
	WHERE r.Component_ID = ?;`

	row := m.DB.QueryRow(stmt, id)

	r := &models.Recipe{}

	err := row.Scan(&r.Result.ID, &r.Result.Name, &r.Result.Weight, &r.Result.Type, &r.Result.Note)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, models.ErrNoRecord
		} else {
			return nil, err
		}
	}

	// Получаем ингридиенты
	stmt = `SELECT c.Component_ID, c.Name, c.Weight, c.Type, c.Note, ri.Quantity
	FROM recipeitem ri
	JOIN component c ON ri.Component_ID = c.Component_ID
	WHERE ri.Recipe_Component_ID = ?;`

	rows, err := m.DB.Query(stmt, id)
	if err != nil {
		return nil, err
	}

	defer rows.Close()

	for rows.Next() {
		ri := models.RecipeItem{}

		err := rows.Scan(&ri.Ingredient.ID, &ri.Ingredient.Name, &ri.Ingredient.Weight, &ri.Ingredient.Type, &ri.Ingredient.Note, &ri.Quantity)

		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return nil, models.ErrNoRecord
			} else {
				return nil, err
			}
		}

		r.Items = append(r.Items, ri)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return r, nil
}

// Insert вставляет запись в recipe и связанные записи в recipeitem.
// r.Result.ID должен быть уже существующим Component_ID (результат).
func (m *RecipeModel) Insert(r *models.Recipe) error {
	tx, err := m.DB.Begin()
	if err != nil {
		return err
	}
	// защитный откат в случае паники
	defer func() {
		if p := recover(); p != nil {
			_ = tx.Rollback()
			panic(p)
		}
	}()

	// вставляем шапку рецепта (Component_ID указан)
	_, err = tx.Exec(
		`INSERT INTO recipe (Component_ID, Type) VALUES (?, ?)`,
		r.Result.ID, r.Result.Type,
	)
	if err != nil {
		_ = tx.Rollback()
		return err
	}

	// подготовим вставку ингредиентов.
	// предполагаем, что idRecipeItem — автоинкремент (если нет — нужно передавать id)
	stmt, err := tx.Prepare(`
		INSERT INTO recipeitem (Quantity, Component_ID, Recipe_Component_ID)
		VALUES (?, ?, ?)
	`)
	if err != nil {
		_ = tx.Rollback()
		return err
	}
	defer stmt.Close()

	for _, it := range r.Items {
		if _, err := stmt.Exec(it.Quantity, it.Ingredient.ID, r.Result.ID); err != nil {
			_ = tx.Rollback()
			return err
		}
	}

	if err := tx.Commit(); err != nil {
		return err
	}
	return nil
}

// SelectAll возвращает все рецепты с результатами и ингредиентами.
func (m *RecipeModel) SelectAll() ([]*models.Recipe, error) {
	// 1) берем все рецепты и данные результирующего компонента
	rows, err := m.DB.Query(`
		SELECT r.Component_ID, r.Type, c.Component_ID, c.Name, c.Weight, c.Type, c.Note
		FROM recipe r
		JOIN component c ON r.Component_ID = c.Component_ID
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var recipes []*models.Recipe

	for rows.Next() {
		var recipeCompID int
		var recipeType string
		var compID int
		var compName string
		var compWeight float64
		var compType string
		var compNote sql.NullString

		if err := rows.Scan(&recipeCompID, &recipeType, &compID, &compName, &compWeight, &compType, &compNote); err != nil {
			return nil, err
		}

		r := &models.Recipe{
			Result: models.Component{
				ID:     compID,
				Name:   compName,
				Weight: compWeight,
				Type:   compType,
				Note:   compNote.String,
			},
			Items: nil,
		}
		// recipe.Component_ID == compID (result id)
		_ = recipeCompID // для ясности; recipeCompID == compID
		recipes = append(recipes, r)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// 2) для каждого рецепта — загружаем ингредиенты (можно оптимизировать одним IN-запросом)
	for _, r := range recipes {
		itemsRows, err := m.DB.Query(`
			SELECT ri.idRecipeItem, ri.Quantity, ri.Component_ID, c.Name, c.Weight, c.Type, c.Note
			FROM recipeitem ri
			JOIN component c ON ri.Component_ID = c.Component_ID
			WHERE ri.Recipe_Component_ID = ?
		`, r.Result.ID)
		if err != nil {
			return nil, err
		}

		var items []models.RecipeItem
		for itemsRows.Next() {
			var idRecipeItem int
			var qty int
			var compID int
			var name string
			var weight float64
			var ctype string
			var note sql.NullString

			if err := itemsRows.Scan(&idRecipeItem, &qty, &compID, &name, &weight, &ctype, &note); err != nil {
				itemsRows.Close()
				return nil, err
			}
			items = append(items, models.RecipeItem{
				Ingredient: models.Component{
					ID:     compID,
					Name:   name,
					Weight: weight,
					Type:   ctype,
					Note:   note.String,
				},
				Quantity: qty,
			})
		}
		itemsRows.Close()
		if err := itemsRows.Err(); err != nil {
			return nil, err
		}
		r.Items = items
	}

	return recipes, nil
}

// Update полностью заменяет ингредиенты и обновляет Type рецепта.
// Используется транзакция.
func (m *RecipeModel) Update(r *models.Recipe) error {
	tx, err := m.DB.Begin()
	if err != nil {
		return err
	}
	defer func() {
		if p := recover(); p != nil {
			_ = tx.Rollback()
			panic(p)
		}
	}()

	// Обновляем type в recipe
	_, err = tx.Exec(`UPDATE recipe SET Type = ? WHERE Component_ID = ?`, r.Result.Type, r.Result.ID)
	if err != nil {
		_ = tx.Rollback()
		return err
	}

	// Удаляем старые ingredients по Recipe_Component_ID
	_, err = tx.Exec(`DELETE FROM recipeitem WHERE Recipe_Component_ID = ?`, r.Result.ID)
	if err != nil {
		_ = tx.Rollback()
		return err
	}

	// Вставляем заново ингредиенты
	stmt, err := tx.Prepare(`
		INSERT INTO recipeitem (Quantity, Component_ID, Recipe_Component_ID) 
		VALUES (?, ?, ?)
	`)
	if err != nil {
		_ = tx.Rollback()
		return err
	}
	defer stmt.Close()

	for _, it := range r.Items {
		if _, err := stmt.Exec(it.Quantity, it.Ingredient.ID, r.Result.ID); err != nil {
			_ = tx.Rollback()
			return err
		}
	}

	if err := tx.Commit(); err != nil {
		return err
	}
	return nil
}

// Delete удаляет рецепт и связанные ингредиенты по Component_ID (результату).
func (m *RecipeModel) Delete(recipeComponentID int) error {
	tx, err := m.DB.Begin()
	if err != nil {
		return err
	}
	defer func() {
		if p := recover(); p != nil {
			_ = tx.Rollback()
			panic(p)
		}
	}()

	// Удаляем ингредиенты
	if _, err := tx.Exec(`DELETE FROM recipeitem WHERE Recipe_Component_ID = ?`, recipeComponentID); err != nil {
		_ = tx.Rollback()
		return err
	}

	// Удаляем сам рецепт
	if _, err := tx.Exec(`DELETE FROM recipe WHERE Component_ID = ?`, recipeComponentID); err != nil {
		_ = tx.Rollback()
		return err
	}

	if err := tx.Commit(); err != nil {
		return err
	}
	return nil
}
