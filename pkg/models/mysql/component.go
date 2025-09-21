package mysql

import (
	"database/sql"
	"errors"
	"warehouse-inventory/pkg/models"
)

type ComponentModel struct {
	DB *sql.DB
}

func NewComponentModel(db *sql.DB) *ComponentModel {
	return &ComponentModel{
		DB: db,
	}
}

func (m *ComponentModel) SelectByType(componentType string) ([]*models.Component, error) {
	stmt := `SELECT * From component where Type = ?`

	rows, err := m.DB.Query(stmt, componentType)
	if err != nil {
		return nil, err
	}

	defer rows.Close()

	var components []*models.Component

	for rows.Next() {
		c := &models.Component{}

		err := rows.Scan(&c.ID, &c.Name, &c.Weight, &c.Type, &c.Note)

		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return nil, models.ErrNoRecord
			} else {
				return nil, err
			}
		}

		components = append(components, c)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return components, nil
}

// Возвращает компонент с определенным ID
func (m *ComponentModel) SelectByID(id int) (*models.Component, error) {
	stmt := `SELECT * FROM component
	WHERE Component_ID = ?`

	row := m.DB.QueryRow(stmt, id)

	c := &models.Component{}

	err := row.Scan(&c.ID, &c.Name, &c.Weight, &c.Type, &c.Note)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, models.ErrNoRecord
		} else {
			return nil, err
		}
	}

	return c, nil
}

// Возвращает все компоненты с таблицы
func (m *ComponentModel) SelectAll() ([]*models.Component, error) {
	stmt := `SELECT * From component`

	rows, err := m.DB.Query(stmt)
	if err != nil {
		return nil, err
	}

	defer rows.Close()

	var components []*models.Component

	for rows.Next() {
		c := &models.Component{}

		err := rows.Scan(&c.ID, &c.Name, &c.Weight, &c.Type, &c.Note)

		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return nil, models.ErrNoRecord
			} else {
				return nil, err
			}
		}

		components = append(components, c)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return components, nil
}

// Вставлвяет в таблицу строку с указанными данными
func (m *ComponentModel) Insert(name string, weight float64, componentType string, note string) error {
	stmt := `INSERT INTO component(Name, Weight, Type, Note)
	VALUES (?, ?, ?, ?)`

	_, err := m.DB.Exec(stmt, name, weight, componentType, note)
	if err != nil {
		return err
	}

	return nil
}

// Удаляет элемент в таблице по ID
func (m *ComponentModel) DeleteByID(id int) error {
	stmt := `DELETE FROM component
	WHERE Component_ID = ?`

	_, err := m.DB.Exec(stmt, id)
	if err != nil {
		return err
	}

	return nil
}

func (m *ComponentModel) Update(id int, name string, weight float64, componentType string, note string) error {
	stmt := `UPDATE component
	SET Name = ?,
		Weight = ?,
		Type = ?,
		Note = ?
	WHERE Component_ID = ?`

	_, err := m.DB.Exec(stmt, name, weight, componentType, note, id)
	if err != nil {
		return err
	}

	return nil
}
