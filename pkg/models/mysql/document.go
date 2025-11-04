package mysql

import (
	"database/sql"
	"errors"
	"fmt"
	"warehouse-inventory/pkg/models"
)

type DocumentModel struct {
	DB *sql.DB
}

func NewDocumentModel(db *sql.DB) *DocumentModel { return &DocumentModel{DB: db} }

const productionStorageID = 1 // склад производства — жёстко = 1

// ============================================================================
// SELECT'ы
// ============================================================================

// SelectByID получает документ с позициями по ID
func (m *DocumentModel) SelectByID(id int) (*models.Document, error) {
	stmt := `SELECT Document_ID, Type, CreatedAt, CreatedBy, Notes,
	                MovementOrder_Order_ID, ProductionOrder_ID, StorageSite_ID
	         FROM document
	         WHERE Document_ID = ?`

	row := m.DB.QueryRow(stmt, id)

	d := &models.Document{}
	var notes sql.NullString
	var moID sql.NullInt64
	var poID sql.NullInt64
	var ssID sql.NullInt64

	if err := row.Scan(&d.ID, &d.Type, &d.CreatedAt, &d.CreatedBy, &notes, &moID, &poID, &ssID); err != nil {
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
	if ssID.Valid {
		v := int(ssID.Int64)
		d.StorageID = &v
	}

	// Позиции документа
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
		if err := rows.Scan(
			&it.ID,
			&it.Component.ID,
			&it.Component.Name,
			&it.Component.Weight,
			&it.Component.Type,
			&note,
			&it.Quantity, // int
		); err != nil {
			return nil, err
		}
		if note.Valid {
			it.Component.Note = note.String
		}
		d.Items = append(d.Items, it)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return d, nil
}

// SelectByType возвращает список документов по типу
func (m *DocumentModel) SelectByType(dtype string) ([]*models.Document, error) {
	stmt := `SELECT Document_ID, Type, CreatedAt, CreatedBy, Notes,
	                MovementOrder_Order_ID, ProductionOrder_ID, StorageSite_ID
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
		var ssID sql.NullInt64

		if err := rows.Scan(&d.ID, &d.Type, &d.CreatedAt, &d.CreatedBy, &notes, &moID, &poID, &ssID); err != nil {
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
		if ssID.Valid {
			v := int(ssID.Int64)
			d.StorageID = &v
		}

		// Позиции
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
			if err := itemRows.Scan(
				&it.ID,
				&it.Component.ID,
				&it.Component.Name,
				&it.Component.Weight,
				&it.Component.Type,
				&note,
				&it.Quantity, // int
			); err != nil {
				itemRows.Close()
				return nil, err
			}
			if note.Valid {
				it.Component.Note = note.String
			}
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

// SelectAll — все документы
func (m *DocumentModel) SelectAll() ([]*models.Document, error) {
	stmt := `SELECT Document_ID, Type, CreatedAt, CreatedBy, Notes,
	                MovementOrder_Order_ID, ProductionOrder_ID, StorageSite_ID
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
		var ssID sql.NullInt64

		if err := rows.Scan(&d.ID, &d.Type, &d.CreatedAt, &d.CreatedBy, &notes, &moID, &poID, &ssID); err != nil {
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
		if ssID.Valid {
			v := int(ssID.Int64)
			d.StorageID = &v
		}

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
			if err := itemRows.Scan(
				&it.ID,
				&it.Component.ID,
				&it.Component.Name,
				&it.Component.Weight,
				&it.Component.Type,
				&note,
				&it.Quantity, // int
			); err != nil {
				itemRows.Close()
				return nil, err
			}
			if note.Valid {
				it.Component.Note = note.String
			}
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

func (m *DocumentModel) SelectByStorage(id int) ([]*models.Document, error) {
	stmt := `SELECT Document_ID, Type, CreatedAt, CreatedBy, Notes,
	                MovementOrder_Order_ID, ProductionOrder_ID, StorageSite_ID
	         FROM document
	         WHERE StorageSite_ID = ?`

	rows, err := m.DB.Query(stmt, id)
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
		var ssID sql.NullInt64

		if err := rows.Scan(&d.ID, &d.Type, &d.CreatedAt, &d.CreatedBy, &notes, &moID, &poID, &ssID); err != nil {
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
		if ssID.Valid {
			v := int(ssID.Int64)
			d.StorageID = &v
		}

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
			if err := itemRows.Scan(
				&it.ID,
				&it.Component.ID,
				&it.Component.Name,
				&it.Component.Weight,
				&it.Component.Type,
				&note,
				&it.Quantity, // int
			); err != nil {
				itemRows.Close()
				return nil, err
			}
			if note.Valid {
				it.Component.Note = note.String
			}
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

// ============================================================================
// INSERT'ы (принимают *models.Document; при необходимости + аргументы)
// ============================================================================

// Insert — общий роутер для обратной совместимости.
// В идеале в новом коде сразу вызывать конкретные методы ниже.
func (m *DocumentModel) Insert(d *models.Document, extra ...any) (*models.Document, error) {
	if d == nil {
		return nil, errors.New("nil document")
	}
	switch d.Type {
	case "buy":
		return m.InsertBuy(d)
	case "sale":
		return m.InsertSale(d)
	case "productionCreate":
		return m.InsertProductionCreate(d)
	case "productionFinish":
		return m.InsertProductionFinish(d)
	default:
		return nil, fmt.Errorf("unsupported document type: %s", d.Type)
	}
}

// InsertBuy — документ покупки: +инвентарь на выбранный склад
// Требуется: d.StorageID != nil, d.Items (Component.ID, Quantity>0), d.CreatedBy
func (m *DocumentModel) InsertBuy(d *models.Document) (*models.Document, error) {
	if d == nil {
		return nil, errors.New("nil document")
	}
	if d.StorageID == nil || *d.StorageID <= 0 {
		return nil, errors.New("storage required for buy")
	}
	if len(d.Items) == 0 {
		return nil, errors.New("empty items for buy")
	}

	tx, err := m.DB.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	docID, err := m.insertDocumentHeaderTx(tx, "buy", d.CreatedBy, d.Notes, d.MovementOrderID, d.ProductionOrderID, d.StorageID)
	if err != nil {
		return nil, err
	}
	if err := m.insertDocumentItemsTx(tx, docID, d.Items); err != nil {
		return nil, err
	}

	// Инвентарь: upsert (+)
	for _, it := range d.Items {
		if it.Component.ID == 0 || it.Quantity <= 0 {
			continue
		}
		if _, err := tx.Exec(`
			INSERT INTO inventory (Component_ID, StorageSite_ID, Quantity)
			VALUES (?, ?, ?)
			ON DUPLICATE KEY UPDATE Quantity = Quantity + VALUES(Quantity)
		`, it.Component.ID, *d.StorageID, it.Quantity); err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}
	d.ID = docID
	d.Type = "buy"
	return d, nil
}

// InsertSale — документ продажи: -инвентарь с выбранного склада
// Требуется: d.StorageID != nil, d.Items (Component.ID, Quantity>0), d.CreatedBy
func (m *DocumentModel) InsertSale(d *models.Document) (*models.Document, error) {
	if d == nil {
		return nil, errors.New("nil document")
	}
	if d.StorageID == nil || *d.StorageID <= 0 {
		return nil, errors.New("storage required for sale")
	}
	if len(d.Items) == 0 {
		return nil, errors.New("empty items for sale")
	}

	tx, err := m.DB.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	docID, err := m.insertDocumentHeaderTx(tx, "sale", d.CreatedBy, d.Notes, d.MovementOrderID, d.ProductionOrderID, d.StorageID)
	if err != nil {
		return nil, err
	}
	if err := m.insertDocumentItemsTx(tx, docID, d.Items); err != nil {
		return nil, err
	}

	for _, it := range d.Items {
		if it.Component.ID == 0 || it.Quantity <= 0 {
			continue
		}
		if _, err := tx.Exec(`
			UPDATE inventory
			   SET Quantity = Quantity - ?
			 WHERE Component_ID = ? AND StorageSite_ID = ?
		`, it.Quantity, it.Component.ID, *d.StorageID); err != nil {
			return nil, err
		}
		// чистим нули
		if _, err := tx.Exec(`
			DELETE FROM inventory
			 WHERE Component_ID = ? AND StorageSite_ID = ? AND Quantity = 0
		`, it.Component.ID, *d.StorageID); err != nil {
			return nil, fmt.Errorf("error when cleaning zeros in component %v", it.Component.ID)
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}
	d.ID = docID
	d.Type = "sale"
	return d, nil
}

// InsertProductionCreate — начало производства по нескольким рецептурам.
// Ожидается, что d.Items содержит ПЛАН ВЫПУСКА: для каждой позиции
// d.Items[i].Component.ID == Recipe.Result.ID, d.Items[i].Quantity > 0.
// Создаёт productionorder, пишет его позиции, рассчитывает и списывает
// ингредиенты со склада #1, затем создаёт документ 'productionCreate'
// с позициями-ингредиентами.
//
// Требуется: d.CreatedBy (обязателен). Все количества — int.
func (m *DocumentModel) InsertProductionCreate(d *models.Document) (*models.Document, error) {
	if d == nil {
		return nil, errors.New("nil document")
	}
	if d.CreatedBy == 0 {
		return nil, errors.New("CreatedBy is required")
	}
	if len(d.Items) == 0 {
		return nil, errors.New("plan (d.Items) is empty")
	}

	const productionStorageID = 1

	// На базе текущего подключения делаем локальную модель рецептур.
	rm := &RecipeModel{DB: m.DB}

	tx, err := m.DB.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	// 1) Создаём productionorder (на складе 1)
	res, err := tx.Exec(`INSERT INTO productionorder (ProductionSite_StorageSite_ID) VALUES (?)`, productionStorageID)
	if err != nil {
		return nil, fmt.Errorf("insert productionorder failed: %w", err)
	}
	orderID64, err := res.LastInsertId()
	if err != nil {
		return nil, err
	}
	orderID := int(orderID64)

	// 2) Записываем позиции productionorderitem по плану выпуска из d.Items
	//    (каждый item — это результат рецептуры и его количество).
	for _, it := range d.Items {
		resultID := it.Component.ID
		qty := it.Quantity
		if resultID <= 0 || qty <= 0 {
			return nil, errors.New("invalid plan item (resultID or quantity)")
		}
		if _, err := tx.Exec(`
			INSERT INTO productionorderitem (ProductionOrder_ID, Recipe_Component_ID, Quantity)
			VALUES (?, ?, ?)
		`, orderID, resultID, qty); err != nil {
			return nil, fmt.Errorf("insert productionorderitem failed: %w", err)
		}
	}

	// 3) Считаем суммарную потребность в ингредиентах по всем рецептурам из плана
	need := make(map[int]int) // IngredientID -> total required qty
	for _, it := range d.Items {
		resultID := it.Component.ID
		qtyPlan := it.Quantity
		if resultID <= 0 || qtyPlan <= 0 {
			return nil, errors.New("invalid plan item (resultID or quantity)")
		}

		// Тянем рецептуру (resultID = Recipe.Result.ID)
		recipe, err := rm.SelectByID(resultID)
		if err != nil {
			return nil, fmt.Errorf("select recipe %d failed: %w", resultID, err)
		}
		if recipe == nil || len(recipe.Items) == 0 {
			return nil, fmt.Errorf("recipe %d has no items", resultID)
		}

		// Суммируем ингредиенты: требуемое = qtyPlan * ingredient.Quantity
		for _, ri := range recipe.Items {
			ingID := ri.Ingredient.ID
			ingQty := ri.Quantity
			if ingID <= 0 || ingQty <= 0 {
				return nil, fmt.Errorf("invalid recipe item for recipe %d", resultID)
			}
			need[ingID] += ingQty * qtyPlan
		}
	}
	if len(need) == 0 {
		return nil, errors.New("aggregated ingredients are empty")
	}

	// 4) Жёсткое списание ингредиентов со склада 1 под транзакционной блокировкой
	for compID, req := range need {
		if req <= 0 {
			continue
		}

		var cur int
		if err := tx.QueryRow(`
			SELECT Quantity
			  FROM inventory
			 WHERE Component_ID = ? AND StorageSite_ID = ?
			 FOR UPDATE
		`, compID, productionStorageID).Scan(&cur); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return nil, fmt.Errorf("no inventory for component %d on storage %d", compID, productionStorageID)
			}
			return nil, err
		}

		if cur < req {
			return nil, fmt.Errorf("insufficient inventory for component %d: have %d, need %d", compID, cur, req)
		}

		if _, err := tx.Exec(`
			UPDATE inventory
			   SET Quantity = Quantity - ?
			 WHERE Component_ID = ? AND StorageSite_ID = ?
		`, req, compID, productionStorageID); err != nil {
			return nil, fmt.Errorf("inventory decrement failed (component %d): %w", compID, err)
		}

		if _, err := tx.Exec(`
			DELETE FROM inventory
			 WHERE Component_ID = ? AND StorageSite_ID = ? AND Quantity = 0
		`, compID, productionStorageID); err != nil {
			return nil, fmt.Errorf("inventory zero cleanup failed (component %d): %w", compID, err)
		}
	}

	// 5) Документ 'productionCreate' (StorageSite_ID = NULL, ProductionOrder_ID = orderID)
	docID, err := m.insertDocumentHeaderTx(tx, "productionCreate", d.CreatedBy, d.Notes, nil, &orderID, nil)
	if err != nil {
		return nil, err
	}

	// 6) Позиции документа — СПИСАННЫЕ ингредиенты (а не план выпуска!)
	docItems := make([]models.DocumentItem, 0, len(need))
	for compID, q := range need {
		if q <= 0 {
			continue
		}
		docItems = append(docItems, models.DocumentItem{
			Component: models.Component{ID: compID},
			Quantity:  q,
		})
	}
	if err := m.insertDocumentItemsTx(tx, docID, docItems); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	// Заполняем возвращаемый документ фактическими данными
	d.ID = docID
	d.Type = "productionCreate"
	d.ProductionOrderID = &orderID
	d.Items = docItems // здесь — уже ингредиенты, списанные со склада
	return d, nil
}

// InsertProductionFinish — завершение производства:
// 1) начисляет готовые изделия на склад 1 (по productionorderitem),
// 2) закрывает заказ,
// 3) пишет документ 'productionFinish' с позициями-результатами.
// Требуется: d.ProductionOrderID != nil, d.CreatedBy
func (m *DocumentModel) InsertProductionFinish(d *models.Document) (*models.Document, error) {
	if d == nil {
		return nil, errors.New("nil document")
	}
	if d.ProductionOrderID == nil || *d.ProductionOrderID <= 0 {
		return nil, errors.New("production order id required")
	}

	orderID := *d.ProductionOrderID

	tx, err := m.DB.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	// 1) Проверка заказа (не закрыт?)
	var closed sql.NullTime
	if err := tx.QueryRow(`
		SELECT ClosedAt FROM productionorder WHERE ProductionOrder_ID = ?
	`, orderID).Scan(&closed); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, models.ErrNoRecord
		}
		return nil, err
	}
	if closed.Valid {
		return nil, fmt.Errorf("production order %d already closed", orderID)
	}

	// 2) Позиции заказа = результаты
	rows, err := tx.Query(`
		SELECT Recipe_Component_ID, Quantity
		  FROM productionorderitem
		 WHERE ProductionOrder_ID = ?
	`, orderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type out struct{ compID, qty int }
	var outs []out
	for rows.Next() {
		var compID, qty int
		if err := rows.Scan(&compID, &qty); err != nil {
			return nil, err
		}
		if qty > 0 {
			outs = append(outs, out{compID: compID, qty: qty})
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(outs) == 0 {
		return nil, errors.New("production order has no items to finish")
	}

	// 3) Начислить готовые изделия на склад 1
	for _, o := range outs {
		if _, err := tx.Exec(`
			INSERT INTO inventory (Component_ID, StorageSite_ID, Quantity)
			VALUES (?, ?, ?)
			ON DUPLICATE KEY UPDATE Quantity = Quantity + VALUES(Quantity)
		`, o.compID, productionStorageID, o.qty); err != nil {
			return nil, fmt.Errorf("inventory upsert (finish) failed for component %d: %w", o.compID, err)
		}
	}

	// 4) Закрыть заказ
	if _, err := tx.Exec(`
		UPDATE productionorder SET ClosedAt = CURRENT_TIMESTAMP
		 WHERE ProductionOrder_ID = ?
	`, orderID); err != nil {
		return nil, fmt.Errorf("close production order failed: %w", err)
	}

	// 5) Документ 'productionFinish'
	docID, err := m.insertDocumentHeaderTx(tx, "productionFinish", d.CreatedBy, d.Notes, nil, &orderID, nil)
	if err != nil {
		return nil, err
	}

	// 6) Позиции документа — результаты
	docItems := make([]models.DocumentItem, 0, len(outs))
	for _, o := range outs {
		docItems = append(docItems, models.DocumentItem{
			Component: models.Component{ID: o.compID},
			Quantity:  o.qty,
		})
	}
	if err := m.insertDocumentItemsTx(tx, docID, docItems); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	d.ID = docID
	d.Type = "productionFinish"
	d.Items = docItems
	return d, nil
}

// ============================================================================
// DELETE
// ============================================================================

func (m *DocumentModel) Delete(id int) error {
	_, err := m.DB.Exec(`DELETE FROM document WHERE Document_ID = ?`, id)
	return err
}

// ============================================================================
// Приватные хелперы
// ============================================================================

func (m *DocumentModel) insertDocumentHeaderTx(
	tx *sql.Tx,
	dtype string,
	createdBy int,
	notes string,
	moveOrderID *int,
	prodOrderID *int,
	storageID *int,
) (int, error) {
	stmt := `INSERT INTO document (Type, CreatedBy, Notes, MovementOrder_Order_ID, ProductionOrder_ID, StorageSite_ID)
	         VALUES (?, ?, ?, ?, ?, ?)`

	var mo interface{}
	if moveOrderID != nil {
		mo = *moveOrderID
	}
	var po interface{}
	if prodOrderID != nil {
		po = *prodOrderID
	}
	var ss interface{}
	if storageID != nil {
		ss = *storageID
	}

	res, err := tx.Exec(stmt, dtype, createdBy, notes, mo, po, ss)
	if err != nil {
		return 0, err
	}
	docID64, err := res.LastInsertId()
	if err != nil {
		return 0, err
	}
	return int(docID64), nil
}

func (m *DocumentModel) insertDocumentItemsTx(tx *sql.Tx, docID int, items []models.DocumentItem) error {
	if len(items) == 0 {
		return nil
	}
	stmt := `INSERT INTO documentitem (Document_ID, Component_ID, Quantity)
	         VALUES (?, ?, ?)`
	for _, it := range items {
		if it.Component.ID == 0 || it.Quantity == 0 {
			continue
		}
		if _, err := tx.Exec(stmt, docID, it.Component.ID, it.Quantity); err != nil {
			return err
		}
	}
	return nil
}
