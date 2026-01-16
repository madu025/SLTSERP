import { ItemService } from './inventory/item.service';
import { StoreService } from './inventory/store.service';
import { StockService } from './inventory/stock.service';
import { GRNService } from './inventory/grn.service';
import { IssueService } from './inventory/issue.service';
import { MRNService } from './inventory/mrn.service';
import { WastageService } from './inventory/wastage.service';
import { StockRequestService } from './inventory/stock-request.service';
import { TransactionService } from './inventory/transaction.service';

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
