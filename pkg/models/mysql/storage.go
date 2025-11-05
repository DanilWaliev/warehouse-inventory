package mysql

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"
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

// Возвращает хранилище и весь его инвентарь.
func (m *StorageModel) SelectWithInventoryByID(storageID int) (*models.Storage, error) {
	// 1) Шапка + данные из transitstorage (если есть)
	const header = `
		SELECT
			s.StorageSite_ID,
			s.Name,
			s.Location,
			s.Type,
			s.Note,
			t.TransportType,
			t.Capacity
		FROM storagesite s
		LEFT JOIN transitstorage t ON t.StorageSite_ID = s.StorageSite_ID
		WHERE s.StorageSite_ID = ?;
	`
	row := m.DB.QueryRow(header, storageID)

	st := &models.Storage{}
	var tt sql.NullString
	var cap sql.NullFloat64

	if err := row.Scan(&st.ID, &st.Name, &st.Location, &st.Type, &st.Note, &tt, &cap); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, models.ErrNoRecord
		}
		return nil, err
	}
	if tt.Valid {
		v := tt.String
		st.TransportType = &v
	}
	if cap.Valid {
		v := cap.Float64
		st.Capacity = &v
	}

	// 2) Инвентарь
	const items = `
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
	rows, err := m.DB.Query(items, storageID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var it models.StorageItem
		if err := rows.Scan(
			&it.Component.ID,
			&it.Component.Name,
			&it.Component.Weight,
			&it.Component.Type,
			&it.Component.Note,
			&it.Quantity,
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
	const q = `
		SELECT
			s.StorageSite_ID,
			s.Name,
			s.Location,
			s.Type,
			s.Note,
			t.TransportType,
			t.Capacity
		FROM storagesite s
		LEFT JOIN transitstorage t ON t.StorageSite_ID = s.StorageSite_ID
		ORDER BY s.StorageSite_ID;
	`
	rows, err := m.DB.Query(q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var res []*models.Storage
	for rows.Next() {
		st := &models.Storage{}
		var tt sql.NullString
		var cap sql.NullFloat64

		if err := rows.Scan(
			&st.ID, &st.Name, &st.Location, &st.Type, &st.Note,
			&tt, &cap,
		); err != nil {
			return nil, err
		}
		if tt.Valid {
			v := tt.String
			st.TransportType = &v
		}
		if cap.Valid {
			v := cap.Float64
			st.Capacity = &v
		}
		res = append(res, st)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return res, nil
}

func (m *StorageModel) SelectWithoutInventoryByID(id int) (*models.Storage, error) {
	const q = `
		SELECT
			s.StorageSite_ID,
			s.Name,
			s.Location,
			s.Type,
			s.Note,
			t.TransportType,
			t.Capacity
		FROM storagesite s
		LEFT JOIN transitstorage t ON t.StorageSite_ID = s.StorageSite_ID
		WHERE s.StorageSite_ID = ?;
	`
	row := m.DB.QueryRow(q, id)

	st := &models.Storage{}
	var tt sql.NullString
	var cap sql.NullFloat64

	if err := row.Scan(
		&st.ID, &st.Name, &st.Location, &st.Type, &st.Note,
		&tt, &cap,
	); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, models.ErrNoRecord
		}
		return nil, err
	}
	if tt.Valid {
		v := tt.String
		st.TransportType = &v
	}
	if cap.Valid {
		v := cap.Float64
		st.Capacity = &v
	}
	return st, nil
}

func (m *StorageModel) SelectAllWithInventory() ([]*models.Storage, error) {
	// 1) Все хранилища (+ возможные поля транзита)
	const headers = `
		SELECT
			s.StorageSite_ID,
			s.Name,
			s.Location,
			s.Type,
			s.Note,
			t.TransportType,
			t.Capacity
		FROM storagesite s
		LEFT JOIN transitstorage t ON t.StorageSite_ID = s.StorageSite_ID
		ORDER BY s.StorageSite_ID;
	`
	rows, err := m.DB.Query(headers)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	stores := make([]*models.Storage, 0, 16)
	idx := make(map[int]*models.Storage)

	for rows.Next() {
		st := &models.Storage{}
		var tt sql.NullString
		var cap sql.NullFloat64

		if err := rows.Scan(
			&st.ID, &st.Name, &st.Location, &st.Type, &st.Note,
			&tt, &cap,
		); err != nil {
			return nil, err
		}
		if tt.Valid {
			v := tt.String
			st.TransportType = &v
		}
		if cap.Valid {
			v := cap.Float64
			st.Capacity = &v
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

	// 2) Общая выборка инвентаря и раскладка по складам
	const items = `
		SELECT 
			i.StorageSite_ID,
			c.Component_ID, c.Name, c.Weight, c.Type, c.Note,
			i.Quantity
		FROM inventory i
		JOIN component c ON c.Component_ID = i.Component_ID
		ORDER BY i.StorageSite_ID, c.Name;
	`
	itRows, err := m.DB.Query(items)
	if err != nil {
		return nil, err
	}
	defer itRows.Close()

	for itRows.Next() {
		var storageID int
		var it models.StorageItem
		if err := itRows.Scan(
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
	if err := itRows.Err(); err != nil {
		return nil, err
	}

	return stores, nil
}

func (m *StorageModel) SelectWithInventoryByType(stype string) ([]*models.Storage, error) {
	// 1) Список складов нужного типа (+ transitstorage данные)
	const headers = `
		SELECT
			s.StorageSite_ID,
			s.Name,
			s.Location,
			s.Type,
			s.Note,
			t.TransportType,
			t.Capacity
		FROM storagesite s
		LEFT JOIN transitstorage t ON t.StorageSite_ID = s.StorageSite_ID
		WHERE s.Type = ?
		ORDER BY s.StorageSite_ID;
	`
	rows, err := m.DB.Query(headers, stype)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var storages []*models.Storage
	idList := make([]int, 0, 16)
	idx := make(map[int]*models.Storage)

	for rows.Next() {
		st := &models.Storage{}
		var tt sql.NullString
		var cap sql.NullFloat64

		if err := rows.Scan(
			&st.ID, &st.Name, &st.Location, &st.Type, &st.Note,
			&tt, &cap,
		); err != nil {
			return nil, err
		}
		if tt.Valid {
			v := tt.String
			st.TransportType = &v
		}
		if cap.Valid {
			v := cap.Float64
			st.Capacity = &v
		}

		storages = append(storages, st)
		idx[st.ID] = st
		idList = append(idList, st.ID)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(storages) == 0 {
		return storages, nil
	}

	// 2) Инвентарь только по этим складам
	placeholders := make([]string, len(idList))
	args := make([]any, len(idList))
	for i, id := range idList {
		placeholders[i] = "?"
		args[i] = id
	}

	q := fmt.Sprintf(`
		SELECT 
			i.StorageSite_ID,
			c.Component_ID, c.Name, c.Weight, c.Type, c.Note,
			i.Quantity
		FROM inventory i
		JOIN component c ON c.Component_ID = i.Component_ID
		WHERE i.StorageSite_ID IN (%s)
		ORDER BY i.StorageSite_ID, c.Name;
	`, strings.Join(placeholders, ","))
	itRows, err := m.DB.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer itRows.Close()

	for itRows.Next() {
		var storageID int
		var it models.StorageItem
		if err := itRows.Scan(
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
	if err := itRows.Err(); err != nil {
		return nil, err
	}

	return storages, nil
}

func (m *StorageModel) SelectWithoutInventoryByType(stype string) ([]*models.Storage, error) {
	var (
		rows *sql.Rows
		err  error
	)

	if stype == "transitstorage" {
		// Показываем только те транзитные склады, у которых есть строка в transitstorage
		const q = `
			SELECT
				s.StorageSite_ID,
				s.Name,
				s.Location,
				s.Type,
				s.Note,
				t.TransportType,
				t.Capacity
			FROM storagesite s
			INNER JOIN transitstorage t ON t.StorageSite_ID = s.StorageSite_ID
			WHERE s.Type = 'transitstorage'
			ORDER BY s.StorageSite_ID;
		`
		rows, err = m.DB.Query(q)
	} else {
		const q = `
			SELECT
				s.StorageSite_ID,
				s.Name,
				s.Location,
				s.Type,
				s.Note
			FROM storagesite s
			WHERE s.Type = ?
			ORDER BY s.StorageSite_ID;
		`
		rows, err = m.DB.Query(q, stype)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*models.Storage

	for rows.Next() {
		s := &models.Storage{}
		if stype == "transitstorage" {
			var tt sql.NullString
			var cap sql.NullFloat64

			if err := rows.Scan(
				&s.ID, &s.Name, &s.Location, &s.Type, &s.Note,
				&tt, &cap,
			); err != nil {
				return nil, err
			}

			// Если хотите жёстко требовать наличие данных:
			if !tt.Valid || !cap.Valid {
				return nil, fmt.Errorf("missing transitstorage row for storage_id=%d", s.ID)
			}

			// Эти поля должны существовать в вашей модели:
			//   TransportType *string
			//   Capacity      *float64
			ttv := tt.String
			cpv := cap.Float64
			s.TransportType = &ttv
			s.Capacity = &cpv

		} else {
			if err := rows.Scan(
				&s.ID, &s.Name, &s.Location, &s.Type, &s.Note,
			); err != nil {
				return nil, err
			}
		}
		out = append(out, s)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return out, nil
}

// Создание скалада
func (m *StorageModel) InsertWarehouse(name, location, note string) error {
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
		`INSERT INTO storagesite (Name, Type, Location, Note) VALUES (?, ?, ?, ?)`,
		name, "warehouse", location, note,
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
		`INSERT INTO warehouse (StorageSite_ID) VALUES (?)`,
		id,
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

func (m *StorageModel) InsertTransitStorage(name, location, stype, transportType string, capacity float64, note string) error {
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
		`INSERT INTO storagesite (Name, Type, Location, Note) VALUES (?, ?, ?, ?)`,
		name, "transitstorage", location, note,
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
		`INSERT INTO transitstorage (StorageSite_ID, TransportType, Capacity) VALUES (?, ?, ?)`,
		id, transportType, capacity,
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

// Обновление склада
func (m *StorageModel) UpdateWarehouse(id int, name, location, note string) error {
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

	// обновляем общую таблицу
	_, err = tx.Exec(
		`UPDATE storagesite SET Name=?, Location=?, Note=? WHERE StorageSite_ID=? AND Type='warehouse'`,
		name, location, note, id,
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

// Обновление транзитного хранилища
func (m *StorageModel) UpdateTransitStorage(
	id int, name, location, transportType string, capacity float64, note string,
) error {
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

	// обновляем storagesite
	_, err = tx.Exec(
		`UPDATE storagesite SET Name=?, Location=?, Note=? WHERE StorageSite_ID=? AND Type='transitstorage'`,
		name, location, note, id,
	)
	if err != nil {
		_ = tx.Rollback()
		return err
	}

	// обновляем доп. данные по транзитному хранилищу
	_, err = tx.Exec(
		`UPDATE transitstorage SET TransportType=?, Capacity=? WHERE StorageSite_ID=?`,
		transportType, capacity, id,
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

// DeleteWarehouse удаляет склад и запись в storagesite.
func (m *StorageModel) DeleteWarehouse(id int) error {
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

	// Сначала удаляем запись-спутник
	if _, err := tx.Exec(`DELETE FROM warehouse WHERE StorageSite_ID = ?`, id); err != nil {
		_ = tx.Rollback()
		return err
	}
	// Потом сам сторедж-сайт
	if _, err := tx.Exec(`DELETE FROM storagesite WHERE StorageSite_ID = ? AND Type = 'warehouse'`, id); err != nil {
		_ = tx.Rollback()
		return err
	}
	return tx.Commit()
}

// DeleteTransitStorage удаляет транзитное хранилище и запись в storagesite.
func (m *StorageModel) DeleteTransitStorage(id int) error {
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

	// Сначала удаляем запись-спутник
	if _, err := tx.Exec(`DELETE FROM transitstorage WHERE StorageSite_ID = ?`, id); err != nil {
		_ = tx.Rollback()
		return err
	}
	// Потом сам сторедж-сайт
	if _, err := tx.Exec(`DELETE FROM storagesite WHERE StorageSite_ID = ? AND Type = 'transitstorage'`, id); err != nil {
		_ = tx.Rollback()
		return err
	}
	return tx.Commit()
}
