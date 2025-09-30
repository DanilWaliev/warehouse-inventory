package mysql

import (
	"database/sql"
	"errors"
	"warehouse-inventory/pkg/models"
)

type StorageModel struct {
	DB *sql.DB
}

func NewStorageModel(db *sql.DB) *StorageModel {
	return &StorageModel{
		DB: db,
	}
}

// SelectWithInventoryByID возвращает хранилище и весь его инвентарь.
// Storage.Note <- storagesite.Location
// Storage.Type <- storagesite.Type
func (m *StorageModel) SelectWithInventoryByID(storageID int) (*models.Storage, error) {
	// 1) Шапка хранилища
	headerStmt := `
		SELECT s.StorageSite_ID, s.Location, s.Type
		FROM storagesite s
		WHERE s.StorageSite_ID = ?;
	`
	row := m.DB.QueryRow(headerStmt, storageID)

	st := &models.Storage{}
	var location string
	if err := row.Scan(&st.ID, &location, &st.Type); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, models.ErrNoRecord
		}
		return nil, err
	}
	st.Location = location

	// 2) Позиции инвентаря (join component)
	itemsStmt := `
		SELECT
			c.Component_ID,
			c.Name,
			c.Weight,
			c.Type,
			c.Note,
			i.Quantity
		FROM inventory i
		JOIN component c ON c.Component_ID = i.Component_ID
		WHERE i.StorageSite_ID = ?
		ORDER BY c.Name;
	`

	rows, err := m.DB.Query(itemsStmt, storageID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var it models.StorageItem
		var qtyDec float64

		if err := rows.Scan(
			&it.Component.ID,
			&it.Component.Name,
			&it.Component.Weight,
			&it.Component.Type,
			&it.Component.Note,
			&qtyDec,
		); err != nil {
			return nil, err
		}

		st.Inventory = append(st.Inventory, it)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return st, nil
}

func (m *StorageModel) SelectAllWithoutInventory() ([]*models.Storage, error) {
	rows, err := m.DB.Query(`
		SELECT s.StorageSite_ID, s.Location, s.Type
		FROM storagesite s
		ORDER BY s.StorageSite_ID`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var res []*models.Storage
	for rows.Next() {
		st := &models.Storage{}
		if err := rows.Scan(&st.ID, &st.Location, &st.Type); err != nil {
			return nil, err
		}
		res = append(res, st)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return res, nil
}

func (m *StorageModel) SelectWithoutInventoryByID(id int) (*models.Storage, error) {
	row := m.DB.QueryRow(`
		SELECT s.StorageSite_ID, s.Location, s.Type
		FROM storagesite s
		WHERE s.StorageSite_ID = ?`, id)

	st := &models.Storage{}
	if err := row.Scan(&st.ID, &st.Location, &st.Type); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, models.ErrNoRecord
		}
		return nil, err
	}
	return st, nil
}

func (m *StorageModel) SelectAllWithInventory() ([]*models.Storage, error) {
	// 1) Загружаем все хранилища
	rows, err := m.DB.Query(`
		SELECT s.StorageSite_ID, s.Location, s.Type
		FROM storagesite s
		ORDER BY s.StorageSite_ID`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	stores := make([]*models.Storage, 0, 16)
	idx := make(map[int]*models.Storage)
	for rows.Next() {
		st := &models.Storage{}
		if err := rows.Scan(&st.ID, &st.Location, &st.Type); err != nil {
			return nil, err
		}
		stores = append(stores, st)
		idx[st.ID] = st
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(stores) == 0 {
		return stores, nil
	}

	// 2) Подтягиваем инвентарь для всех хранилищ одной выборкой
	items, err := m.DB.Query(`
		SELECT 
			i.StorageSite_ID,
			c.Component_ID, c.Name, c.Weight, c.Type, c.Note,
			i.Quantity
		FROM inventory i
		JOIN component c ON c.Component_ID = i.Component_ID
		ORDER BY i.StorageSite_ID, c.Name`)
	if err != nil {
		return nil, err
	}
	defer items.Close()

	for items.Next() {
		var storageID int
		var it models.StorageItem
		if err := items.Scan(
			&storageID,
			&it.Component.ID,
			&it.Component.Name,
			&it.Component.Weight,
			&it.Component.Type,
			&it.Component.Note,
			&it.Quantity,
		); err != nil {
			return nil, err
		}
		if st := idx[storageID]; st != nil {
			st.Inventory = append(st.Inventory, it)
		}
	}
	if err := items.Err(); err != nil {
		return nil, err
	}

	return stores, nil
}

func (m *StorageModel) SelectWithInventoryByType(stype string) ([]*models.Storage, error) {
	// 1) Шапка хранилища
	headerStmt := `
		SELECT s.StorageSite_ID, s.Location, s.Type
		FROM storagesite s
		WHERE s.Type = ?;
	`
	rows, err := m.DB.Query(headerStmt, stype)
	if err != nil {
		return nil, err
	}

	defer rows.Close()

	var storages []*models.Storage

	for rows.Next() {
		s := &models.Storage{}

		err := rows.Scan(&s.ID, &s.Location, &s.Type)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return nil, models.ErrNoRecord
			}
			return nil, err
		}

		storages = append(storages, s)
	}

	// 2) Позиции инвентаря (join component)
	itemsStmt := `
		SELECT
			c.Component_ID,
			c.Name,
			c.Weight,
			c.Type,
			c.Note,
			i.Quantity
		FROM inventory i
		JOIN component c ON c.Component_ID = i.Component_ID
		WHERE i.Type = ?
		ORDER BY c.Name;
	`

	for _, s := range storages {
		rows, err := m.DB.Query(itemsStmt, stype)
		if err != nil {
			return nil, err
		}
		defer rows.Close()

		for rows.Next() {
			var it models.StorageItem
			var qtyDec float64

			if err := rows.Scan(
				&it.Component.ID,
				&it.Component.Name,
				&it.Component.Weight,
				&it.Component.Type,
				&it.Component.Note,
				&qtyDec,
			); err != nil {
				return nil, err
			}

			s.Inventory = append(s.Inventory, it)
		}
		if err := rows.Err(); err != nil {
			return nil, err
		}
	}

	return storages, nil
}

func (m *StorageModel) SelectWithoutInventoryByType(stype string) ([]*models.Storage, error) {
	headerStmt := `
		SELECT s.StorageSite_ID, s.Location, s.Type
		FROM storagesite s
		WHERE s.Type = ?;
	`
	rows, err := m.DB.Query(headerStmt, stype)
	if err != nil {
		return nil, err
	}

	defer rows.Close()

	var storages []*models.Storage

	for rows.Next() {
		s := &models.Storage{}

		err := rows.Scan(&s.ID, &s.Location, &s.Type)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return nil, models.ErrNoRecord
			}
			return nil, err
		}

		storages = append(storages, s)
	}

	return storages, nil
}

// Создание скалада
func (m *StorageModel) InsertWarehouse(location string, stype string, notes string) error {
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

	res, err := tx.Exec(
		`INSERT INTO storagesite (Name, Type, Location) VALUES (?, ?, ?)`,
		"warehouse", stype, location,
	)
	if err != nil {
		_ = tx.Rollback()
		return err
	}
	id, err := res.LastInsertId()
	if err != nil {
		_ = tx.Rollback()
		return err
	}

	_, err = tx.Exec(
		`INSERT INTO warehouse (StorageSite_ID, Notes) VALUES (?, ?)`,
		id, notes,
	)
	if err != nil {
		_ = tx.Rollback()
		return err
	}

	if err := tx.Commit(); err != nil {
		return err
	}
	return nil
}

func (m *StorageModel) InsertTransitStorage(location string, stype string, transportType string, capacity float64, notes string) error {
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

	res, err := tx.Exec(
		`INSERT INTO storagesite (Name, Type, Location) VALUES (?, ?, ?)`,
		"transitstorage", stype, location,
	)
	if err != nil {
		_ = tx.Rollback()
		return err
	}
	id, err := res.LastInsertId()
	if err != nil {
		_ = tx.Rollback()
		return err
	}

	_, err = tx.Exec(
		`INSERT INTO transitstorage (StorageSite_ID, TransportType, Capacity, Notes) VALUES (?, ?, ?, ?)`,
		id, transportType, capacity, notes,
	)
	if err != nil {
		_ = tx.Rollback()
		return err
	}

	if err := tx.Commit(); err != nil {
		return err
	}
	return nil
}
