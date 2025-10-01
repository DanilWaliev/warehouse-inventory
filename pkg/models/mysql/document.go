package mysql

import (
	"database/sql"
	"errors"
	"warehouse-inventory/pkg/models"
)

type DocumentModel struct {
	DB *sql.DB
}

func NewDocumentModel(db *sql.DB) *DocumentModel {
	return &DocumentModel{
		DB: db,
	}
}

// SelectByID получает документ с позициями по ID
func (m *DocumentModel) SelectByID(id int) (*models.Document, error) {
	stmt := `SELECT Document_ID, Type, CreatedAt, CreatedBy, Notes,
	                MovementOrder_Order_ID, ProductionOrder_ID
	         FROM document
	         WHERE Document_ID = ?`

	row := m.DB.QueryRow(stmt, id)

	d := &models.Document{}
	var notes sql.NullString
	var moID sql.NullInt64
	var poID sql.NullInt64

	err := row.Scan(&d.ID, &d.Type, &d.CreatedAt, &d.CreatedBy, &notes, &moID, &poID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, models.ErrNoRecord
		}
		return nil, err
	}

	if notes.Valid {
		d.Notes = notes.String
	}
	if moID.Valid {
		v := int(moID.Int64)
		d.MovementOrderID = &v
	}
	if poID.Valid {
		v := int(poID.Int64)
		d.ProductionOrderID = &v
	}

	// подгружаем позиции документа
	stmt = `SELECT di.Item_ID, di.Component_ID, c.Name, c.Weight, c.Type, c.Note, di.Quantity
	        FROM documentitem di
	        JOIN component c ON di.Component_ID = c.Component_ID
	        WHERE di.Document_ID = ?`

	rows, err := m.DB.Query(stmt, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		it := models.DocumentItem{}
		var note sql.NullString
		if err := rows.Scan(&it.ID, &it.Component.ID, &it.Component.Name,
			&it.Component.Weight, &it.Component.Type, &note, &it.Quantity); err != nil {
			return nil, err
		}
		if note.Valid {
			it.Component.Note = note.String
		}
		it.DocumentID = d.ID
		d.Items = append(d.Items, it)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return d, nil
}

// SelectByType возвращае список документов по типу
func (m *DocumentModel) SelectByType(dtype string) ([]*models.Document, error) {
	stmt := `SELECT Document_ID, Type, CreatedAt, CreatedBy, Notes,
	                MovementOrder_Order_ID, ProductionOrder_ID
	         FROM document
	         WHERE Type = ?`

	rows, err := m.DB.Query(stmt, dtype)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var docs []*models.Document

	for rows.Next() {
		d := &models.Document{}
		var notes sql.NullString
		var moID sql.NullInt64
		var poID sql.NullInt64

		if err := rows.Scan(&d.ID, &d.Type, &d.CreatedAt, &d.CreatedBy, &notes, &moID, &poID); err != nil {
			return nil, err
		}
		if notes.Valid {
			d.Notes = notes.String
		}
		if moID.Valid {
			v := int(moID.Int64)
			d.MovementOrderID = &v
		}
		if poID.Valid {
			v := int(poID.Int64)
			d.ProductionOrderID = &v
		}

		// подгружаем позиции
		itemsStmt := `SELECT di.Item_ID, di.Component_ID, c.Name, c.Weight, c.Type, c.Note, di.Quantity
		              FROM documentitem di
		              JOIN component c ON di.Component_ID = c.Component_ID
		              WHERE di.Document_ID = ?`

		itemRows, err := m.DB.Query(itemsStmt, d.ID)
		if err != nil {
			return nil, err
		}

		for itemRows.Next() {
			it := models.DocumentItem{}
			var note sql.NullString
			if err := itemRows.Scan(&it.ID, &it.Component.ID, &it.Component.Name,
				&it.Component.Weight, &it.Component.Type, &note, &it.Quantity); err != nil {
				itemRows.Close()
				return nil, err
			}
			if note.Valid {
				it.Component.Note = note.String
			}
			it.DocumentID = d.ID
			d.Items = append(d.Items, it)
		}
		itemRows.Close()

		docs = append(docs, d)
	}

	if err = rows.Err(); err != nil {
		return nil, err
	}

	return docs, nil
}

// SelectAll возвращает список документов без фильтров
func (m *DocumentModel) SelectAll() ([]*models.Document, error) {
	stmt := `SELECT Document_ID, Type, CreatedAt, CreatedBy, Notes,
	                MovementOrder_Order_ID, ProductionOrder_ID
	         FROM document
	         ORDER BY CreatedAt DESC`

	rows, err := m.DB.Query(stmt)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var docs []*models.Document

	for rows.Next() {
		d := &models.Document{}
		var notes sql.NullString
		var moID sql.NullInt64
		var poID sql.NullInt64

		if err := rows.Scan(&d.ID, &d.Type, &d.CreatedAt, &d.CreatedBy, &notes, &moID, &poID); err != nil {
			return nil, err
		}
		if notes.Valid {
			d.Notes = notes.String
		}
		if moID.Valid {
			v := int(moID.Int64)
			d.MovementOrderID = &v
		}
		if poID.Valid {
			v := int(poID.Int64)
			d.ProductionOrderID = &v
		}

		// подгружаем позиции
		itemsStmt := `SELECT di.Item_ID, di.Component_ID, c.Name, c.Weight, c.Type, c.Note, di.Quantity
		              FROM documentitem di
		              JOIN component c ON di.Component_ID = c.Component_ID
		              WHERE di.Document_ID = ?`

		itemRows, err := m.DB.Query(itemsStmt, d.ID)
		if err != nil {
			return nil, err
		}

		for itemRows.Next() {
			it := models.DocumentItem{}
			var note sql.NullString
			if err := itemRows.Scan(&it.ID, &it.Component.ID, &it.Component.Name,
				&it.Component.Weight, &it.Component.Type, &note, &it.Quantity); err != nil {
				itemRows.Close()
				return nil, err
			}
			if note.Valid {
				it.Component.Note = note.String
			}
			it.DocumentID = d.ID
			d.Items = append(d.Items, it)
		}
		itemRows.Close()

		docs = append(docs, d)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return docs, nil
}

// Insert создаёт документ и его позиции
func (m *DocumentModel) Insert(d *models.Document) error {
	tx, err := m.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt := `INSERT INTO document (Type, CreatedBy, Notes, MovementOrder_Order_ID, ProductionOrder_ID)
	         VALUES (?, ?, ?, ?, ?)`
	res, err := tx.Exec(stmt,
		d.Type,
		d.CreatedBy,
		d.Notes,
		d.MovementOrderID,
		d.ProductionOrderID,
	)
	if err != nil {
		return err
	}

	docID, err := res.LastInsertId()
	if err != nil {
		return err
	}
	d.ID = int(docID)

	stmt = `INSERT INTO documentitem (Document_ID, Component_ID, Quantity)
	        VALUES (?, ?, ?)`
	for _, item := range d.Items {
		_, err := tx.Exec(stmt, d.ID, item.Component.ID, item.Quantity)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

// Delete удаляет документ и его позиции
func (m *DocumentModel) Delete(id int) error {
	stmt := `DELETE FROM document WHERE Document_ID = ?`
	_, err := m.DB.Exec(stmt, id)
	return err
}
