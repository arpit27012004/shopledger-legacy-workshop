var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

test('invoice figures match order pricing for HSN tax and coupon discount', function () {
  var order = {
    id: 7,
    items: [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 2 }],
    coupon: 'WELCOME',
    subtotal: 200,
    discount: 10,
    tax: 9.5,
    total: 199.5
  };

  assert.deepEqual(invoice.computeInvoiceFigures(order), {
    subtotal: 200,
    discount: 10,
    tax: 9.5,
    cgst: 4.75,
    sgst: 4.75,
    total: 199.5,
    rows: [{
      name: 'Rice', sku: '-', hsn: '1006', qty: 2, price: 100,
      gstPercent: 5, line: 200, lineTax: 9.5
    }]
  });
});

test('order pricing uses the HSN slab and taxes the discounted value', function () {
  var items = [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 2 }];
  var totals = pricing.computeTotals(items, 'WELCOME');

  assert.deepEqual(totals, {
    subtotal: 200,
    discount: 10,
    taxable: 190,
    tax: 9.5,
    cgst: 4.75,
    sgst: 4.75,
    total: 199.5,
    lines: [{
      id: 1,
      name: 'Rice',
      hsn: '1006',
      gstPercent: 5,
      gross: 200,
      discount: 10,
      taxable: 190,
      tax: 9.5,
      net: 199.5
    }]
  });
});

test('invoice uses the HSN slab when no coupon is applied', function () {
  var order = {
    id: 7,
    items: [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 2 }],
    coupon: '',
    total: 199.5
  };

  assert.deepEqual(invoice.computeInvoiceFigures(order), {
    subtotal: 200,
    discount: 0,
    tax: 10,
    cgst: 5,
    sgst: 5,
    total: 210,
    rows: [{
      name: 'Rice', sku: '-', hsn: '1006', qty: 2, price: 100,
      gstPercent: 5, line: 200, lineTax: 10
    }]
  });
});

test('invoice applies the order coupon to subtotal before calculating tax', function () {
  var order = {
    id: 8,
    items: [{ name: 'Rice', hsn: '1006', price: 100, qty: 2 }],
    coupon: 'WELCOME',
    subtotal: 200,
    discount: 10,
    tax: 9.5,
    total: 199.5
  };
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.subtotal, 200);
  assert.equal(figures.tax, 9.5);
  assert.equal(figures.discount, 10);
  assert.equal(figures.total, 199.5);
  assert.equal(figures.cgst, 4.75);
  assert.equal(figures.sgst, 4.75);
});

test('GST reconciliation matches invoice figures to the stored order ledger', function () {
  var db = {
    orders: [{
      id: 9,
      date: '2026-11-21',
      customer: 'In-memory customer',
      items: [{ name: 'Rice', hsn: '1006', price: 100, qty: 2 }],
      coupon: 'WELCOME',
      subtotal: 200,
      discount: 10,
      tax: 9.5,
      total: 199.5
    }],
    products: [],
    customers: []
  };

  assert.deepEqual(reports.getGstReconciliation(db), {
    totalChecked: 1,
    mismatchCount: 0,
    totalDelta: 0,
    rows: [{
      orderId: 9,
      date: '2026-11-21',
      customer: 'In-memory customer',
      coupon: 'WELCOME',
      ledgerSubtotal: 200,
      ledgerDiscount: 10,
      ledgerTax: 9.5,
      ledgerTotal: 199.5,
      invoiceDiscount: 10,
      invoiceTax: 9.5,
      invoiceTotal: 199.5,
      delta: 0,
      matched: true
    }]
  });
});

test('rendered invoice shows the ledger total without a mismatch banner', function () {
  var html = invoice.render({
    id: 10,
    date: '2026-11-21',
    items: [{ name: 'Rice', hsn: '1006', price: 100, qty: 2 }],
    coupon: 'WELCOME',
    total: 199.5
  });

  assert.match(html, /Invoice Total[\s\S]*?₹199\.50/);
  assert.doesNotMatch(html, /differs from Order Ledger recorded total/);
});
