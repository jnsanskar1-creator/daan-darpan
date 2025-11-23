--
-- PostgreSQL database dump
--

-- Dumped from database version 16.9
-- Dumped by pg_dump version 16.9

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: dravya_entries; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.dravya_entries (
    id integer NOT NULL,
    user_id integer NOT NULL,
    user_name text NOT NULL,
    user_mobile text,
    user_address text,
    description text NOT NULL,
    occasion text DEFAULT ''::text NOT NULL,
    entry_date text NOT NULL,
    created_by text DEFAULT 'system'::text NOT NULL,
    updated_at text DEFAULT '2025-07-26T11:09:44.804Z'::text NOT NULL
);


ALTER TABLE public.dravya_entries OWNER TO neondb_owner;

--
-- Name: dravya_entries_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.dravya_entries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.dravya_entries_id_seq OWNER TO neondb_owner;

--
-- Name: dravya_entries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.dravya_entries_id_seq OWNED BY public.dravya_entries.id;


--
-- Name: entries; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.entries (
    id integer NOT NULL,
    user_id integer NOT NULL,
    user_name text NOT NULL,
    description text NOT NULL,
    amount integer DEFAULT 0 NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    total_amount integer NOT NULL,
    occasion text NOT NULL,
    auction_date text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    pending_amount integer NOT NULL,
    received_amount integer DEFAULT 0 NOT NULL,
    payments json DEFAULT '[]'::json NOT NULL,
    user_mobile text,
    user_address text,
    updated_at text DEFAULT '2025-07-26T11:09:44.803Z'::text NOT NULL,
    created_by text DEFAULT 'system'::text NOT NULL
);


ALTER TABLE public.entries OWNER TO neondb_owner;

--
-- Name: entries_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.entries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.entries_id_seq OWNER TO neondb_owner;

--
-- Name: entries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.entries_id_seq OWNED BY public.entries.id;


--
-- Name: expense_entries; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.expense_entries (
    id integer NOT NULL,
    description text NOT NULL,
    amount integer NOT NULL,
    quantity integer NOT NULL,
    reason text NOT NULL,
    expense_date text NOT NULL,
    payment_mode text NOT NULL,
    attachment_url text,
    approved_by text NOT NULL,
    created_by text NOT NULL,
    updated_at text DEFAULT '2025-07-26T11:09:44.804Z'::text NOT NULL
);


ALTER TABLE public.expense_entries OWNER TO neondb_owner;

--
-- Name: expense_entries_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.expense_entries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.expense_entries_id_seq OWNER TO neondb_owner;

--
-- Name: expense_entries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.expense_entries_id_seq OWNED BY public.expense_entries.id;


--
-- Name: transaction_logs; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.transaction_logs (
    id integer NOT NULL,
    entry_id integer NOT NULL,
    user_id integer NOT NULL,
    username text NOT NULL,
    transaction_type text NOT NULL,
    amount integer NOT NULL,
    description text NOT NULL,
    date text DEFAULT '2025-07-26'::text NOT NULL,
    details json NOT NULL,
    "timestamp" text DEFAULT '2025-07-26T11:09:44.804Z'::text NOT NULL
);


ALTER TABLE public.transaction_logs OWNER TO neondb_owner;

--
-- Name: transaction_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.transaction_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.transaction_logs_id_seq OWNER TO neondb_owner;

--
-- Name: transaction_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.transaction_logs_id_seq OWNED BY public.transaction_logs.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username text NOT NULL,
    password text NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    mobile text DEFAULT ''::text NOT NULL,
    address text DEFAULT ''::text NOT NULL,
    role text DEFAULT 'viewer'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL
);


ALTER TABLE public.users OWNER TO neondb_owner;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO neondb_owner;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: dravya_entries id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.dravya_entries ALTER COLUMN id SET DEFAULT nextval('public.dravya_entries_id_seq'::regclass);


--
-- Name: entries id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.entries ALTER COLUMN id SET DEFAULT nextval('public.entries_id_seq'::regclass);


--
-- Name: expense_entries id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.expense_entries ALTER COLUMN id SET DEFAULT nextval('public.expense_entries_id_seq'::regclass);


--
-- Name: transaction_logs id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.transaction_logs ALTER COLUMN id SET DEFAULT nextval('public.transaction_logs_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: dravya_entries; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.dravya_entries (id, user_id, user_name, user_mobile, user_address, description, occasion, entry_date, created_by, updated_at) FROM stdin;
1	14	Sanskar Jain	08754362789	Sector-42	1 saal ka dravya daan	Paryushan 2024	2025-07-18	sanskar	2025-07-26T08:55:15.379Z
2	14	Sanskar Jain	08754362789	Sector-42	Shantidhara	Paryushan 2024	2025-07-26	sanskar	2025-07-26T09:00:14.710Z
3	14	Sanskar Jain	08754362789	Sector-42	Shantidhara	Routeen	2025-07-26	sanskar	2025-07-26T09:02:07.653Z
4	14	Sanskar Jain	08754362789	Sector-42	1 bora nariyal	Routeen	2025-07-26	sanskar	2025-07-26T09:06:29.569Z
\.


--
-- Data for Name: entries; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.entries (id, user_id, user_name, description, amount, quantity, total_amount, occasion, auction_date, status, pending_amount, received_amount, payments, user_mobile, user_address, updated_at, created_by) FROM stdin;
18	14	Sanskar Jain	11111	2	2	4	23	2025-07-25	pending	4	0	[]	08754362789	Sector-42	2025-07-25 09:27:33.778493+00	sanskar
28	17	Shailesh Jain	Shantidhara	1000	1	1000	Routeen	2025-07-26	pending	1000	0	[]	9425383600	Sector-57	2025-07-26T11:09:44.803Z	sanskar
27	16	Aashi Jain	Katangi Panchkalyanak Boli	100000	1	100000	Routeen	2025-07-26	partial	90000	10000	[{"date":"2025-07-26","amount":10000,"mode":"cash","fileUrl":"","receiptNo":"AM-2025-00001","updatedBy":"sanskar"}]	9009246480	Sector-43	2025-07-26T11:09:44.803Z	sanskar
\.


--
-- Data for Name: expense_entries; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.expense_entries (id, description, amount, quantity, reason, expense_date, payment_mode, attachment_url, approved_by, created_by, updated_at) FROM stdin;
1	Pooja tables	1000000	100	For Paryushan Parva	2025-07-18	upi	https://serpapi.com/manage-api-key	Sanskar	sanskar	2025-07-26T11:13:48.012Z
2	Stool	500000	50	Additional Requirement	2025-07-26	upi	/uploads/receiptFile-1753528914818-517205016.pdf;/uploads/paymentScreenshot-1753528914821-504428358.jpeg	Chairperson	sanskar	2025-07-26T11:21:54.829Z
\.


--
-- Data for Name: transaction_logs; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.transaction_logs (id, entry_id, user_id, username, transaction_type, amount, description, date, details, "timestamp") FROM stdin;
43	27	14	sanskar	credit	100000	Entry created for Aashi Jain by sanskar	2025-07-26	{"description":"Katangi Panchkalyanak Boli","occasion":"Routeen","auctionDate":"2025-07-26"}	2025-07-26T16:28:24.004Z
44	28	14	sanskar	credit	1000	Entry created for Shailesh Jain by sanskar	2025-07-26	{"description":"Shantidhara","occasion":"Routeen","auctionDate":"2025-07-26"}	2025-07-26T16:29:00.182Z
45	27	14	sanskar	debit	10000	Payment of ₹10000 recorded by sanskar	2025-07-26	{"date":"2025-07-26","paymentMode":"cash","receiptNo":"AM-2025-00001"}	2025-07-26T17:49:24.550Z
46	27	14	sanskar	update_payment	0	Payment status changed from pending to partial	2025-07-26	{"payment":{"date":"2025-07-26","amount":10000,"mode":"cash","fileUrl":"","receiptNo":"AM-2025-00001","updatedBy":"sanskar"},"oldStatus":"pending","newStatus":"partial"}	2025-07-26T17:49:24.600Z
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.users (id, username, password, name, email, mobile, address, role, status) FROM stdin;
1	admin	admin123	Administrator	admin@example.com	9876543210	123 Admin St, City	admin	active
14	sanskar	Shared@123	Sanskar Jain	sa@gmail.com	9407452087	Sector-42	operator	active
16	aashi.jain	password	Aashi Jain	aashijain0913@gmail.com	9009246480	Sector-43	viewer	active
17	shailesh	Shared@123	Shailesh Jain	ssandheliya@gmail.com	9425383600	Sector-57	viewer	active
18	Oges	password123	Oges Gurugram	oges@example.com	9821348811	Sample Address 1	viewer	active
\.


--
-- Name: dravya_entries_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.dravya_entries_id_seq', 4, true);


--
-- Name: entries_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.entries_id_seq', 28, true);


--
-- Name: expense_entries_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.expense_entries_id_seq', 2, true);


--
-- Name: transaction_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.transaction_logs_id_seq', 46, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.users_id_seq', 18, true);


--
-- Name: dravya_entries dravya_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.dravya_entries
    ADD CONSTRAINT dravya_entries_pkey PRIMARY KEY (id);


--
-- Name: entries entries_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.entries
    ADD CONSTRAINT entries_pkey PRIMARY KEY (id);


--
-- Name: expense_entries expense_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.expense_entries
    ADD CONSTRAINT expense_entries_pkey PRIMARY KEY (id);


--
-- Name: transaction_logs transaction_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.transaction_logs
    ADD CONSTRAINT transaction_logs_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_unique UNIQUE (username);


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO neon_superuser WITH GRANT OPTION;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON TABLES TO neon_superuser WITH GRANT OPTION;


--
-- PostgreSQL database dump complete
--

