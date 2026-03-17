import { ItemService } from './item.service';
import { StoreService } from './store.service';
import { StockService } from './stock.service';
import { GRNService } from './grn.service';
import { IssueService } from './issue.service';
import { MRNService } from './mrn.service';
import { WastageService } from './wastage.service';
import { StockRequestService } from './stock-request.service';
import { TransactionService } from './transaction.service';

/**
 * InventoryService Facade
 * This class provides a unified interface to the various sub-services 
 * following the Service-Repository pattern.
 */
export class InventoryService {
    // --- UTILS ---
    static round(val: number): number {
        return StockService.round(val);
    }

    // --- ITEM MANAGEMENT ---
    static getItems = ItemService.getItems;
    static createItem = ItemService.createItem;
    static updateItem = ItemService.updateItem;
    static mergeItems = ItemService.mergeItems;
    static patchBulkItems = ItemService.patchBulkItems;
    static deleteItem = ItemService.deleteItem;

    // --- STORE MANAGEMENT ---
    static getStores = StoreService.getStores;
    static createStore = StoreService.createStore;
    static updateStore = StoreService.updateStore;
    static getStore = StoreService.getStore;
    static deleteStore = StoreService.deleteStore;
    static checkLowStock = StoreService.checkLowStock;

    // --- STOCK MANAGEMENT ---
    static getStock = StockService.getStock;
    static getStoreBatches = StockService.getStoreBatches;
    static getContractorBatches = StockService.getContractorBatches;
    static initializeStock = StockService.initializeStock;
    static pickStoreBatchesFIFO = StockService.pickStoreBatchesFIFO;
    static pickContractorBatchesFIFO = StockService.pickContractorBatchesFIFO;
    static createStockIssue = StockService.createStockIssue;
    static getStockIssues = StockService.getStockIssues;

    // --- GRN MANAGEMENT ---
    static getGRNs = GRNService.getGRNs;
    static createGRN = GRNService.createGRN;

    // --- MATERIAL ISSUES & RETURNS ---
    static getMaterialIssues = IssueService.getMaterialIssues;
    static issueMaterial = IssueService.issueMaterial;
    static createMaterialReturn = IssueService.createMaterialReturn;
    static getMaterialReturns = IssueService.getMaterialReturns;

    // --- MRN MANAGEMENT ---
    static createMRN = MRNService.createMRN;
    static getMRNs = MRNService.getMRNs;
    static updateMRNStatus = MRNService.updateMRNStatus;

    // --- WASTAGE MANAGEMENT ---
    static recordWastage = WastageService.recordWastage;

    // --- STOCK REQUEST MANAGEMENT ---
    static createStockRequest = StockRequestService.createStockRequest;
    static getStockRequests = StockRequestService.getStockRequests;
    static processStockRequestAction = StockRequestService.processStockRequestAction;

    // --- TRANSACTION & REPORTING ---
    static getTransactions = TransactionService.getTransactions;
    static saveBalanceSheet = TransactionService.saveBalanceSheet;
}
