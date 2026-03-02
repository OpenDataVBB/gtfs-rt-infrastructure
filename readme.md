# VBB GTFS Realtime feed – Ansible setup

This repo **configures the machines that the [VBB GTFS Realtime (GTFS-RT) feed](https://github.com/OpenDataVBB/gtfs-rt-feed) runs on** using [Ansible](https://docs.ansible.com/ansible/latest/index.html).

> [!TIP]
> If you're just looking for VBB's publicly deployed GTFS-RT feed:
> - [actual GTFS-RT feed](https://production.gtfsrt.vbb.de) ([staging](https://staging.gtfsrt.vbb.de))
> - [parsed in `gtfs-rt-inspector`](https://public-transport.github.io/gtfs-rt-inspector/?feedUrl=https%3A%2F%2Fproduction.gtfsrt.vbb.de%2Fdata&view=inspector) ([staging](https://public-transport.github.io/gtfs-rt-inspector/?feedUrl=https%3A%2F%2Fstaging.gtfsrt.vbb.de%2Fdata&view=inspector))

Conceptually, the data flows as follows through the services making up this project:

```mermaid
flowchart TB
    vdv_453_api{{VBB VDV-453 API}}
    style vdv_453_api fill:#2980b9,stroke:#2980b9
    consumers{{consumers}}
    style consumers fill:#e67e22,stroke:#d35400

    vdv_453_nats_adapter(OpenDataVBB/vdv-453-nats-adapter)
    subgraph gtfs_rt_feed [OpenDataVBB/gtfs-rt-feed]
        vdv_reconciliation_service(vdv-reconciliation-service)
        gtfs_matching_service(gtfs-matching-service)
        gtfs_schedule_data[(GTFS Schedule data)]
    end
    style gtfs_rt_feed fill:none
    nats_consuming_gtfs_rt_server(OpenDataVBB/nats-consuming-gtfs-rt-server)

    vdv_453_api-- VDV-453/-454 data -->vdv_453_nats_adapter
    vdv_453_nats_adapter-- "`VDV-453 *REF-AUS* *SollFahrt*s`" -->vdv_reconciliation_service
    vdv_453_nats_adapter-- "`VDV-454 *AUS* *IstFahrt*s`" -->vdv_reconciliation_service
    vdv_reconciliation_service-- "`reconciled VDV *Fahrt*s`" -->gtfs_matching_service
    gtfs_schedule_data-- "`matching Schedule trip instances`" -->gtfs_matching_service
    gtfs_matching_service-- "`GTFS-RT messages`" -->nats_consuming_gtfs_rt_server
    nats_consuming_gtfs_rt_server-- GTFS-RT feed via HTTP -->consumers
```

Looking from a technical perspective, there are more components involved:

```mermaid
flowchart TB
    classDef machine fill:none,stroke:#9b59b6

    vdv_453_api{{VBB's VDV-453/-454 API a.k.a. *Datendrehscheibe* with realtime data}}
    style vdv_453_api fill:#2980b9,stroke:#2980b9
    consumers{{consumers}}
    style consumers fill:#e67e22,stroke:#d35400

    subgraph project_infrastructure [GTFS-RT infrastructute]
        subgraph vdv_453_proxy [machine *vbb_453_proxy*]
            vdv_453_nats_adapter(OpenDataVBB/vdv-453-nats-adapter)
            vdv_453_proxy_redis[(Redis)]
        end
        class vdv_453_proxy machine
        subgraph gtfs_rt_converter [machine *gtfs_rt_converter*]
            subgraph nats[NATS JetStream]
                nats_ref_aus_sollfahrt["`*REF_AUS_SOLLFAHRT_2* stream`"]:::stream
                nats_aus_istfahrt["`*AUS_ISTFAHRT_2* stream`"]:::stream
                nats_vdv_fahrt["`*VDV_FAHRT_2* stream`"]:::stream
                nats_gtfs_rt["`*GTFS_RT_2* stream`"]:::stream
                classDef stream fill:#ffffde,stroke:#aaaa33
            end
            style nats fill:none
            subgraph services
                vdv_reconciliation_service(vdv-reconciliation-service)
                gtfs_matching_service(gtfs-matching-service)
            end
            style services fill:none,stroke:none
            gtfs_db[(PostgreSQL DB with GTFS Schedule data)]
            gtfs_rt_converter_redis[(Redis)]
        end
        class gtfs_rt_converter machine
        subgraph gtfs_rt_server [machine *gtfs_rt_server*]
            nats_consuming_gtfs_rt_server(OpenDataVBB/nats-consuming-gtfs-rt-server)
        end
        class gtfs_rt_server machine
    end
    style project_infrastructure fill:none

    vdv_453_api<-- 2-way communication via HTTP -->vdv_453_nats_adapter
    vdv_453_nats_adapter-- "`persists VDV subscription state in`" ---vdv_453_proxy_redis
    vdv_453_nats_adapter-- "`VDV-453 *REF-AUS* *SollFahrt* messages`"-->nats_ref_aus_sollfahrt
    nats_ref_aus_sollfahrt-->vdv_reconciliation_service
    vdv_453_nats_adapter-- "`VDV-454 *AUS* *IstFahrt* messages`"-->nats_aus_istfahrt
    nats_aus_istfahrt-->vdv_reconciliation_service
    vdv_reconciliation_service-- "`reconciles *SollFahrt*s & *IstFahrt*s using`" ---gtfs_rt_converter_redis
    vdv_reconciliation_service-- "`VDV *Fahrt*s messages`"-->nats_vdv_fahrt
    nats_vdv_fahrt-->gtfs_matching_service
    gtfs_matching_service-- "`matches VDV *Fahrt*s with`" ---gtfs_db
    gtfs_matching_service-- "`caches matching results using`" ---gtfs_rt_converter_redis
    gtfs_matching_service-- "`GTFS-RT messages`"-->nats_gtfs_rt
    nats_gtfs_rt-->nats_consuming_gtfs_rt_server
    nats_consuming_gtfs_rt_server-- serves GTFS-RT feed via HTTP -->consumers
```

## VDV-453 proxy machines

> [!NOTE]
> Ansible group: `vdv_453_proxy`

These two (staging & production) machines will act as "proxies" (in a logical sense, not in a technical sense) between VBB's VDV-453 API and the machines converting the data to GTFS-RT.

They are VPSes hosted at [Planetary Networks](https://www.planetary-networks.de). They can be administered using their [management UI](https://console.planetary-networks.de:8800/).

## VDV-453 -> GTFS-RT conversion machines

> [!NOTE]
> Ansible group: `gtfs_rt_converter`

These machines convert VDV-453/VDV-454 data (sent by the respective `vdv_453_proxy` machine, see above), convert it into the GTFS-RT format, and serve the GTFS-RT feeds via HTTP.

They are connected to their respective VDV-453/VDV-454 proxy machine via a [Wireguard](https://www.wireguard.com) tunnel, letting them communicate via a [NATS message queue](https://nats.io).

## Running

It is strongly recommended that you run this code with the Ansible version specified in `requirements.txt`. 

```shell
uv pip install -r requirements.txt
# or use pip
```

Then, install [Ansible Galaxy](https://galaxy.ansible.com/) dependencies:

```shell
ansible-galaxy collection install -r ansible-galaxy-requirements.yaml
ansible-galaxy role install -r ansible-galaxy-requirements.yaml
```

> [!NOTE]
> The password required to decrypt the [Ansible-Vault](https://docs.ansible.com/ansible/10/cli/ansible-vault.html)-encrypted secrets in this repository must be in a plain text file at `~/.vault-passwords/vbb-gtfs-rt-infrastructure.private`.

Then, deploy using `ansible-playbook`. Make sure you familiarize yourself with the groups of machines in [the inventory](ansible-inventory.yml).

```shell
ansible-playbook -i ansible-inventory.yml -l "$env" playbooks/all.yml
```
