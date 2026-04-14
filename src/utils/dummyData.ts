import type { TicketsResponse, SummaryResponse, FiltersResponse } from '@/types'

export const DUMMY_FILTERS: FiltersResponse = {
  users: [
    'Anand Verma','Aastha Rai','Rahul Sharma','ishu rana',
    'Vishnuvardhan Goud','Piyush Soni','Prakash Kumar',
    'Niral','Shivam','Deepak Kumar','Akash Kumar',
  ],
  clients: ['Colgate','Jockey','SAAS','BSV','ReckittBenckiser','Henkel','Unilever'],
  pods:    ['DPAI','SNOP','EDM','PLAT','SNOE','PA'],
  projects:['DPAI','SNOP','EDM','PLAT','SNOE','PA'],
}

export const DUMMY_SUMMARY: SummaryResponse = {
  total_hours:   8420,
  total_tickets: 1847,
  by_pod: [
    { pod: 'DPAI',       hours: 2108, tickets: 412, clients: ['Colgate','Jockey'] },
    { pod: 'SNOP',       hours: 1580, tickets: 298, clients: ['SAAS','Colgate']  },
    { pod: 'EDM',        hours: 1302, tickets: 241, clients: ['SAAS','BSV']      },
    { pod: 'PLAT',       hours: 1024, tickets: 198, clients: ['BSV','Jockey']    },
    { pod: 'SNOE',       hours:  791, tickets: 142, clients: ['SAAS']            },
    { pod: 'PA',         hours:  604, tickets: 118, clients: ['Colgate']         },
  ],
  by_client: [
    { client: 'Colgate',          hours: 1480, tickets: 312, users: ['Anand Verma','Rahul Sharma'] },
    { client: 'Jockey',           hours: 1080, tickets: 241, users: ['Aastha Rai','Niral']        },
    { client: 'SAAS',             hours:  864, tickets: 198, users: ['ishu rana','Shivam']         },
    { client: 'BSV',              hours:  612, tickets: 142, users: ['Niral','Piyush Soni']        },
    { client: 'ReckittBenckiser', hours:  540, tickets:  98, users: ['Deepak Kumar']               },
    { client: 'Henkel',           hours:  420, tickets:  87, users: ['Akash Kumar']                },
    { client: 'Unilever',         hours:  380, tickets:  71, users: ['Vishnuvardhan Goud']         },
  ],
  by_user: [
    { user: 'Anand Verma',       hours: 48, tickets: 12, clients: ['Colgate','SAAS']   },
    { user: 'Vishnuvardhan Goud',hours: 42, tickets:  9, clients: ['SAAS','Colgate']   },
    { user: 'Piyush Soni',       hours: 38, tickets:  7, clients: ['SAAS','BSV']       },
    { user: 'Aastha Rai',        hours: 31, tickets: 14, clients: ['Jockey']           },
    { user: 'ishu rana',         hours: 28, tickets: 18, clients: ['SAAS']             },
    { user: 'Rahul Sharma',      hours: 24, tickets:  8, clients: ['Colgate']          },
    { user: 'Niral',             hours: 22, tickets:  5, clients: ['BSV','Jockey']     },
    { user: 'Shivam',            hours: 19, tickets:  4, clients: ['SAAS']             },
    { user: 'Prakash Kumar',     hours: 17, tickets:  6, clients: ['SAAS','BSV']       },
    { user: 'Deepak Kumar',      hours: 15, tickets:  5, clients: ['ReckittBenckiser'] },
    { user: 'Akash Kumar',       hours: 14, tickets:  4, clients: ['Henkel']           },
  ],
}

export const DUMMY_TICKETS: TicketsResponse = {
  count: 1847,
  tickets: [
    { key:'DPAI-6998', project_key:'DPAI', project_name:'DPAI', summary:'ML pipeline for Colgate analytics dashboard', assignee:'Anand Verma', assignee_email:'anand@3sc.com', status:'Done', client:'Colgate', pod:'DPAI', hours_spent:12, original_estimate_hours:16, remaining_estimate_hours:4, created:'2026-03-01', updated:'2026-03-08', issue_type:'Feature', priority:'High', url:'#', worklogs:[] },
    { key:'DPAI-7013', project_key:'DPAI', project_name:'DPAI', summary:'Drag & Drop column resize not working in data grid', assignee:'Aastha Rai', assignee_email:'aastha@3sc.com', status:'Open', client:'Jockey', pod:'DPAI', hours_spent:0, original_estimate_hours:4, remaining_estimate_hours:4, created:'2026-03-12', updated:'2026-03-12', issue_type:'Bug', priority:'High', url:'#', worklogs:[] },
    { key:'DPAI-7007', project_key:'DPAI', project_name:'DPAI', summary:'Failed error text showing in English in Forecasting module', assignee:'ishu rana', assignee_email:'ishu@3sc.com', status:'Done', client:'SAAS', pod:'DPAI', hours_spent:3, original_estimate_hours:4, remaining_estimate_hours:1, created:'2026-03-05', updated:'2026-03-07', issue_type:'Bug', priority:'Medium', url:'#', worklogs:[] },
    { key:'DPAI-6985', project_key:'DPAI', project_name:'DPAI', summary:'AKS Cluster migration to private network', assignee:'Vishnuvardhan Goud', assignee_email:'vishnu@3sc.com', status:'Done', client:'SAAS', pod:'DevOps', hours_spent:10, original_estimate_hours:12, remaining_estimate_hours:2, created:'2026-03-01', updated:'2026-03-15', issue_type:'Feature', priority:'High', url:'#', worklogs:[] },
    { key:'DPAI-6972', project_key:'DPAI', project_name:'DPAI', summary:'EDM data schema migration v8', assignee:'Piyush Soni', assignee_email:'piyush@3sc.com', status:'In Progress', client:'SAAS', pod:'EDM', hours_spent:14, original_estimate_hours:16, remaining_estimate_hours:2, created:'2026-03-01', updated:'2026-03-20', issue_type:'Feature', priority:'High', url:'#', worklogs:[] },
    { key:'DPAI-6960', project_key:'DPAI', project_name:'DPAI', summary:'VAPT scan for DPAI module Q1 security audit', assignee:'Shivam', assignee_email:'shivam@3sc.com', status:'Done', client:'SAAS', pod:'Infosec', hours_spent:7.5, original_estimate_hours:8, remaining_estimate_hours:0.5, created:'2026-03-10', updated:'2026-03-22', issue_type:'Feature', priority:'High', url:'#', worklogs:[] },
    { key:'DPAI-6944', project_key:'DPAI', project_name:'DPAI', summary:'SNP RP v10 Development BSV client integration', assignee:'Niral', assignee_email:'niral@3sc.com', status:'In Progress', client:'BSV', pod:'SNP', hours_spent:9, original_estimate_hours:10, remaining_estimate_hours:1, created:'2026-03-01', updated:'2026-03-25', issue_type:'Feature', priority:'Medium', url:'#', worklogs:[] },
    { key:'DPAI-6930', project_key:'DPAI', project_name:'DPAI', summary:'Daily standup Sprint 42', assignee:'Anand Verma', assignee_email:'anand@3sc.com', status:'Done', client:'SAAS', pod:'DPAI', hours_spent:2.5, original_estimate_hours:0, remaining_estimate_hours:0, created:'2026-03-01', updated:'2026-03-31', issue_type:'Meeting', priority:'Low', url:'#', worklogs:[] },
  ],
}
