package services

import (
	"warehouse-inventory/pkg/models"
	"warehouse-inventory/pkg/models/mysql"
)

type DocumentService struct {
	documentModel *mysql.DocumentModel
}

func NewDocumentService(documentModel *mysql.DocumentModel) *DocumentService {
	return &DocumentService{
		documentModel: documentModel,
	}
}

func (s *DocumentService) ReadAll() ([]*models.Document, error) {
	return s.documentModel.SelectAll()
}

func (s *DocumentService) ReadByIDs(ids []int) ([]*models.Document, error) {
	var documents []*models.Document

	for _, id := range ids {
		doc, err := s.documentModel.SelectByID(id)
		if err != nil {
			return nil, err
		}

		documents = append(documents, doc)
	}

	return documents, nil
}

func (s *DocumentService) ReadByTypes(types []string) ([]*models.Document, error) {
	var documents []*models.Document

	for _, dtype := range types {
		docs, err := s.documentModel.SelectByType(dtype)
		if err != nil {
			return nil, err
		}

		documents = append(documents, docs...)
	}

	return documents, nil
}

func (s *DocumentService) ReadByStorages(storages []int) ([]*models.Document, error) {
	var documents []*models.Document

	for _, storage := range storages {
		docs, err := s.documentModel.SelectByStorage(storage)
		if err != nil {
			return nil, err
		}

		documents = append(documents, docs...)
	}

	return documents, nil
}

func (s *DocumentService) Create(doc *models.Document) error {
	var err error
	switch doc.Type {
	case "buy":
		_, err = s.documentModel.InsertBuy(doc)
	case "sale":
		_, err = s.documentModel.InsertSale(doc)
		//TODO: закончить
	case "productionCreate":
		//_, err = s.documentModel.InsertProductionCreate(doc, )
	case "productionFinish":
		//_, err = s.documentModel.InsertProductionFinish(doc)
	}
	return err
}

func (s *DocumentService) Delete(id int) error {
	return s.documentModel.Delete(id)
}
