import { supabase } from './supabase';
import {
  CustomerField,
  CustomersTableType,
  InvoiceForm,
  InvoicesTable,
  LatestInvoiceRaw,
  Revenue,
} from './definitions';
import { formatCurrency } from './utils';
import { ClientPageRoot } from 'next/dist/client/components/client-page';

export async function fetchRevenue() {
  try {
    console.log('Fetching revenue data...');
    const { data, error } = await supabase.from('revenue').select('*');

    if (error) {
      throw new Error('Failed to fetch revenue data');
    }

    return data;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch revenue data.');
  }
}


export async function fetchLatestInvoices() {
  try {
 

      const { data, error } = await supabase
      .from('invoices')
      .select('amount, customer_id, customers(name, image_url, email), id')
      .order('date', { ascending: false })
      .limit(5);

    if (error) {
      console.log('error : ',error)
      
    }

    const latestInvoices = data?.map((invoice) => ({
      ...invoice,
      amount: formatCurrency(invoice.amount),
    }));

    return latestInvoices;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch the latest invoices.');
  }
}

export async function fetchCardData() {
  try {
    const invoiceCountPromise = supabase.from('invoices').select('*', { count: 'exact' });
    const customerCountPromise = supabase.from('customers').select('*', { count: 'exact' });
    const invoiceStatusPromise = supabase
      .from('invoices')
      .select('amount, status')
      .filter('status', 'in', ['paid', 'pending']); 
    const [invoiceCount, customerCount, invoiceStatus] = await Promise.all([
      invoiceCountPromise,
      customerCountPromise,
      invoiceStatusPromise,
    ]);

    const numberOfInvoices = invoiceCount.count ?? 0;
    const numberOfCustomers = customerCount.count ?? 0;
    const totalPaidInvoices = invoiceStatus?.data?.filter((invoice) => invoice.status === 'paid')
      .reduce((sum, invoice) => sum + invoice.amount, 0);
    const totalPendingInvoices = invoiceStatus?.data?.filter((invoice) => invoice.status === 'pending')
      .reduce((sum, invoice) => sum + invoice.amount, 0);

    return {
      numberOfCustomers,
      numberOfInvoices,
      totalPaidInvoices: formatCurrency(totalPaidInvoices),
      totalPendingInvoices: formatCurrency(totalPendingInvoices),
    };
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch card data.');
  }
}

const ITEMS_PER_PAGE = 6;
export async function fetchFilteredInvoices(query: string, currentPage: number) {
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

  try {
    const { data, error } = await supabase
      .from('invoices')
      .select(`
        id,
        amount,
        date,
        status,
        customers(name, email, image_url)
      `)
      .ilike('customers.name', `%${query}%`)
      .or(`customers.email.ilike.%${query}%, invoices.amount.ilike.%${query}%, invoices.date.ilike.%${query}%, invoices.status.ilike.%${query}%`)
      .range(offset, offset + ITEMS_PER_PAGE)
      .order('date', { ascending: false });

    if (error) {
      throw new Error('Failed to fetch filtered invoices.');
    }

    return data;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch filtered invoices.');
  }
}


export async function fetchInvoicesPages(query: string) {
  try {
    const { data, error } = await supabase
      .from('invoices')
      .select('id', { count: 'exact' })
      .ilike('customers.name', `%${query}%`)
      .or(`customers.email.ilike.%${query}%, invoices.amount.ilike.%${query}%, invoices.date.ilike.%${query}%, invoices.status.ilike.%${query}%`);

    if (error) {
      throw new Error('Failed to fetch total number of invoices.');
    }

    const totalPages = Math.ceil(data.count / ITEMS_PER_PAGE);
    return totalPages;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch total number of invoices.');
  }
}


export async function fetchInvoiceById(id: string) {
  try {
    const { data, error } = await supabase
      .from('invoices')
      .select('id, customer_id, amount, status')
      .eq('id', id)
      .single();

    if (error) {
      throw new Error('Failed to fetch invoice.');
    }

    // Convert amount from cents to dollars
    return { ...data, amount: data.amount / 100 };
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoice.');
  }
}

export async function fetchCustomers() {
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('id, name')
      .order('name', { ascending: true });

    if (error) {
      throw new Error('Failed to fetch all customers.');
    }

    return data;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch all customers.');
  }
}


export async function fetchFilteredCustomers(query: string) {
  try {
    const { data, error } = await supabase
      .from('customers')
      .select(`
        id,
        name,
        email,
        image_url,
        count(invoices.id) AS total_invoices,
        sum(case when invoices.status = 'pending' then invoices.amount else 0 end) AS total_pending,
        sum(case when invoices.status = 'paid' then invoices.amount else 0 end) AS total_paid
      `)
      .ilike('name', `%${query}%`)
      .or(`email.ilike.%${query}%`)
      .leftJoin('invoices', 'customers.id', 'invoices.customer_id')
      .group('customers.id')
      .order('name', { ascending: true });

    if (error) {
      throw new Error('Failed to fetch filtered customers.');
    }

    return data.map((customer) => ({
      ...customer,
      total_pending: formatCurrency(customer.total_pending),
      total_paid: formatCurrency(customer.total_paid),
    }));
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch customer table.');
  }
}
