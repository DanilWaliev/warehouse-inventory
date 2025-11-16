package mysql

import (
	"database/sql"
	"errors"
	"time"
	"warehouse-inventory/pkg/models"
)

type MovementOrderModel struct {
	DB *sql.DB
}

func NewMovementOrderModel(db *sql.DB) *MovementOrderModel {
	return &MovementOrderModel{DB: db}
}

// ----------------- helpers -----------------

func validateOrderStatus(s string) bool {
	switch s {
	case "created", "running", "done":
		return true
	}
	return false
}

func validateBatchStatus(s string) bool {
	switch s {
	case "created", "running", "done":
		return true
	}
	return false
}

// заполняет базовую шапку заказа из одного ряда
func scanOrderRow(row *sql.Row) (*models.MovementOrder, error) {
	var (
		o             models.MovementOrder
		routeID       sql.NullInt64
		ead, asd, aad sql.NullTime
		notes         sql.NullString
	)
	if err := row.Scan(
		&o.ID,
		&routeID,
		&o.Status,
		&o.CreatedBy,
		&o.CreatedAt,
		&ead,
		&asd,
		&aad,
		&notes,
	); err != nil {
		return nil, err
	}
	if routeID.Valid {
		o.Route.ID = int(routeID.Int64)
	}
	if ead.Valid {
		o.Ead = ead.Time
	}
	if asd.Valid {
		o.Asd = asd.Time
	}
	if aad.Valid {
		o.Aad = aad.Time
	}
	if notes.Valid {
		o.Notes = notes.String
	}
	return &o, nil
}

// подгружает партии и их позиции для заказа
func (m *MovementOrderModel) loadBatches(dbq interface {
	Query(query string, args ...any) (*sql.Rows, error)
}, orderID int) ([]models.Batch, error) {

	const qBatches = `
		SELECT
			b.Batch_ID,
			b.BatchNo,
			b.Status
		FROM movementorderbatch b
		WHERE b.MovementOrder_ID = ?
		ORDER BY b.BatchNo ASC`
	rows, err := dbq.Query(qBatches, orderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var batches []models.Batch
	var batchIDs []int

	type batchMeta struct {
		idx int
		id  int
	}
	indexByID := make(map[int]batchMeta)

	for rows.Next() {
		var (
			b       models.Batch
			batchNo int // если пригодится, но в структуре сейчас нет поля для номера партии
		)
		if err := rows.Scan(&b.ID, &batchNo, &b.Status); err != nil {
			return nil, err
		}
		indexByID[b.ID] = batchMeta{idx: len(batches), id: b.ID}
		batches = append(batches, b)
		batchIDs = append(batchIDs, b.ID)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if len(batchIDs) == 0 {
		return batches, nil
	}

	// загрузим позиции для всех партий одной выборкой
	const qItems = `
		SELECT
			i.MovementOrderBatch_ID,
			i.BatchItem_ID,
			c.Component_ID,
			c.Name,
			c.Weight,
			c.Type,
			COALESCE(c.Note, ''),
			i.Quantity
		FROM movementorderbatchitem i
		JOIN component c ON c.Component_ID = i.Component_ID
		WHERE i.MovementOrderBatch_ID IN (
			-- подстановку сделаем через IN с плейсхолдерами
		)`

	// динамически соберём IN (...)
	in := make([]any, 0, len(batchIDs))
	place := make([]byte, 0, len(batchIDs)*2)
	for idx, id := range batchIDs {
		in = append(in, id)
		if idx > 0 {
			place = append(place, ',', ' ')
		}
		place = append(place, '?')
	}
	query := qItems[:len(qItems)-1] + string(place) + ")"

	itemRows, err := dbq.Query(query, in...)
	if err != nil {
		return nil, err
	}
	defer itemRows.Close()

	for itemRows.Next() {
		var (
			batchID int
			item    models.BatchItem
			itemID  int // PK партии-строки нам некуда класть, структура BatchItem без ID
			note    string
		)
		if err := itemRows.Scan(
			&batchID,
			&itemID,
			&item.Component.ID,
			&item.Component.Name,
			&item.Component.Weight,
			&item.Component.Type,
			&note,
			&item.Quantity,
		); err != nil {
			return nil, err
		}
		if meta, ok := indexByID[batchID]; ok {
			batches[meta.idx].Items = append(batches[meta.idx].Items, item)
		}
	}
	if err := itemRows.Err(); err != nil {
		return nil, err
	}

	return batches, nil
}

// ----------------- SELECTs -----------------

// SelectByID — заказ с партиями и их позициями
func (m *MovementOrderModel) SelectByID(id int) (*models.MovementOrder, error) {
	const q = `
		SELECT
			Order_ID,
			Route_ID,
			Status,
			CreatedBy,
			CreatedAt,
			EstimatedArrivalDate,
			ActualShipmentDate,
			ActualArrivalDate,
			Notes
		FROM movementorder
		WHERE Order_ID = ?`
	row := m.DB.QueryRow(q, id)

	order, err := scanOrderRow(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, models.ErrNoRecord
		}
		return nil, err
	}

	// партии и их позиции
	batches, err := m.loadBatches(m.DB, order.ID)
	if err != nil {
		return nil, err
	}
	order.Batches = batches

	return order, nil
}

// SelectAll — все заказы, каждая запись с партиями и их позициями
func (m *MovementOrderModel) SelectAll() ([]*models.MovementOrder, error) {
	const q = `
		SELECT
			Order_ID,
			Route_ID,
			Status,
			CreatedBy,
			CreatedAt,
			EstimatedArrivalDate,
			ActualShipmentDate,
			ActualArrivalDate,
			Notes
		FROM movementorder
		ORDER BY CreatedAt DESC`

	rows, err := m.DB.Query(q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var orders []*models.MovementOrder
	for rows.Next() {
		var (
			o             models.MovementOrder
			routeID       sql.NullInt64
			ead, asd, aad sql.NullTime
			notes         sql.NullString
		)
		if err := rows.Scan(
			&o.ID,
			&routeID,
			&o.Status,
			&o.CreatedBy,
			&o.CreatedAt,
			&ead,
			&asd,
			&aad,
			&notes,
		); err != nil {
			return nil, err
		}
		if routeID.Valid {
			o.Route.ID = int(routeID.Int64)
		}
		if ead.Valid {
			o.Ead = ead.Time
		}
		if asd.Valid {
			o.Asd = asd.Time
		}
		if aad.Valid {
			o.Aad = aad.Time
		}
		if notes.Valid {
			o.Notes = notes.String
		}

		// подгрузим партии и их позиции
		batches, err := m.loadBatches(m.DB, o.ID)
		if err != nil {
			return nil, err
		}
		o.Batches = batches

		orders = append(orders, &o)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return orders, nil
}

// ----------------- INSERT -----------------

// Insert — создаёт заказ и (опционально) партии с позициями.
// Используются поля:
//   - Route.ID (может быть 0/null)
//   - CreatedBy (обязателен)
//   - Ead (если ненулевой), Notes
//   - Batches: если переданы, то каждая партия получит BatchNo = 1..n
func (m *MovementOrderModel) Insert(order *models.MovementOrder) error {
	if order == nil {
		return errors.New("nil MovementOrder")
	}
	if order.CreatedBy <= 0 {
		return errors.New("CreatedBy required")
	}

	tx, err := m.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// 1) вставка заказа
	const qIns = `
		INSERT INTO movementorder
			(Route_ID, Status, CreatedBy, EstimatedArrivalDate, Notes)
		VALUES
			(?, 'created', ?, ?, ?)`

	var routeID *int
	if order.Route.ID > 0 {
		routeID = &order.Route.ID
	}
	var ead *time.Time
	if !order.Ead.IsZero() {
		ead = &order.Ead
	}
	var notes *string
	if order.Notes != "" {
		notes = &order.Notes
	}

	res, err := tx.Exec(qIns, routeID, order.CreatedBy, ead, notes)
	if err != nil {
		return err
	}
	newID64, err := res.LastInsertId()
	if err != nil {
		return err
	}
	order.ID = int(newID64)

	// 2) партии + позиции (если переданы)
	if len(order.Batches) > 0 {
		// вставим по порядку, присваивая BatchNo = 1..n
		const qInsBatch = `
			INSERT INTO movementorderbatch
				(MovementOrder_ID, BatchNo, Status, Notes)
			VALUES
				(?, ?, ?, ?)`

		const qInsItem = `
			INSERT INTO movementorderbatchitem
				(MovementOrderBatch_ID, Component_ID, Quantity)
			VALUES
				(?, ?, ?)`

		for i, b := range order.Batches {
			batchNo := i + 1
			status := b.Status
			if !validateBatchStatus(status) {
				status = "created"
			}
			var bNotes *string // структурой не передаётся Note; при необходимости добавь в модели
			// вставляем партию
			bRes, err := tx.Exec(qInsBatch, order.ID, batchNo, status, bNotes)
			if err != nil {
				return err
			}
			batchID64, err := bRes.LastInsertId()
			if err != nil {
				return err
			}
			batchID := int(batchID64)

			// позиции партии
			for _, it := range b.Items {
				if it.Component.ID <= 0 || it.Quantity <= 0 {
					return errors.New("invalid batch item (component or quantity)")
				}
				if _, err := tx.Exec(qInsItem, batchID, it.Component.ID, it.Quantity); err != nil {
					return err
				}
			}
		}
	}

	return tx.Commit()
}

// ----------------- UPDATE STATUS -----------------

// UpdateStatus — меняет статус заказа.
// allowed: created, running, done
// running -> проставляет ActualShipmentDate = NOW()
// done    -> проставляет ActualArrivalDate  = NOW()
// created -> даты не трогаем
func (m *MovementOrderModel) UpdateStatus(id int, newStatus string) error {
	if id <= 0 {
		return errors.New("invalid id")
	}
	if !validateOrderStatus(newStatus) {
		return errors.New("invalid status")
	}

	tx, err := m.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	switch newStatus {
	case "created":
		if _, err := tx.Exec(`UPDATE movementorder SET Status='created' WHERE Order_ID=?`, id); err != nil {
			return err
		}
	case "running":
		if _, err := tx.Exec(`
			UPDATE movementorder
			   SET Status='running',
			       ActualShipmentDate = NOW()
			 WHERE Order_ID = ?`, id); err != nil {
			return err
		}
	case "done":
		if _, err := tx.Exec(`
			UPDATE movementorder
			   SET Status='done',
			       ActualArrivalDate = NOW()
			 WHERE Order_ID = ?`, id); err != nil {
			return err
		}
	}

	return tx.Commit()
}

// UpdateBatchStatus — меняет статус одной партии по Batch_ID.
// allowed: created, running, done
func (m *MovementOrderModel) UpdateBatchStatus(batchID int, newStatus string) error {
	if batchID <= 0 {
		return errors.New("invalid batchID")
	}
	if !validateBatchStatus(newStatus) {
		return errors.New("invalid status")
	}

	_, err := m.DB.Exec(`UPDATE movementorderbatch SET Status=? WHERE Batch_ID=?`, newStatus, batchID)
	return err
}

// Delete удаляет заказ перемещения по ID.
// Благодаря ON DELETE CASCADE на movementorderbatch и movementorderbatchitem
// при удалении заказа удаляются все его партии и их позиции.
func (m *MovementOrderModel) Delete(id int) error {
	res, err := m.DB.Exec(`DELETE FROM movementorder WHERE Order_ID = ?`, id)
	if err != nil {
		return err
	}
	aff, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if aff == 0 {
		return models.ErrNoRecord
	}
	return nil
}
