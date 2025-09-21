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
	stmt := `SELECT c.ID, c.Name, c.Weight, r.Type, c.Note
	FROM recipe r
	JOIN component c ON r.Component_ID = c.ID
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
	stmt = `SELECT c.ID, c.Name, c.Weight, c.Type, c.Note, ri.Quantity
	FROM recipeitem ri
	JOIN component c ON ri.Component_ID = c.ID
	WHERE ri.Recipe_Component_ID = ?;`

	rows, err := m.DB.Query(stmt, id)
	if err != nil {
		return nil, err
	}

	defer rows.Close()

	for rows.Next() {
		ri := models.RecipeItem{}

		err := rows.Scan(&ri.Ingredient.ID, &ri.Ingredient.Weight, &ri.Ingredient.Type, &ri.Ingredient.Note, &ri.Quantity)

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

func (m *RecipeModel) Insert(r *models.Recipe) error {
	// Начинаем транзакцию
	tx, err := m.DB.Begin()
	if err != nil {
		return err
	}
	defer func() {
		if err != nil {
			tx.Rollback()
		}
	}()

	// Вставляем запись в recipe
	res, err := tx.Exec(`
        INSERT INTO recipe (Component_ID, Type)
        VALUES (?, ?)
    `, r.Result.ID, r.Result.Type)
	if err != nil {
		return err
	}

	// Получаем сгенерированный ID рецепта
	recipeID, err := res.LastInsertId()
	if err != nil {
		return err
	}

	// Вставляем все ингредиенты
	stmt, err := tx.Prepare(`
        INSERT INTO recipeitem (Recipe_ID, Recipe_Component_ID, Quantity)
        VALUES (?, ?, ?)
    `)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, item := range r.Items {
		_, err := stmt.Exec(recipeID, item.Ingredient.ID, item.Quantity)
		if err != nil {
			return err
		}
	}

	// Коммитим транзакцию
	return tx.Commit()
}
