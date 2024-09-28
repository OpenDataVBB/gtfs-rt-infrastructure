# VBB GTFS Realtime feed – Ansible setup

This repo **configures the machines that the [VBB GTFS Realtime (GTFS-RT) feed](https://github.com/OpenDataVBB/gtfs-rt-feed) runs on** using [Ansible](https://docs.ansible.com/ansible/latest/index.html).

```mermaid
flowchart TB
    subgraph external[ ]
        vdv_453_api(VBB VDV-453 API):::external
        consumers(consumers):::external
    end
    style external fill:none,stroke:none
    classDef external fill:#ffd9c2,stroke:#ff8e62
    subgraph vdv_453_proxy["`*vdv_453_proxy* machine`"]
        vdv_453_nats_adapter(OpenDataVBB/vdv-453-nats-adapter)
    end
    style vdv_453_proxy fill:none,stroke:#999999
    subgraph gtfs_rt_converter["`*gtfs_rt_converter* machine`"]
        subgraph nats[NATS JetStream]
            nats_aus_istfahrt["`*AUS_ISTFAHRT_2* stream`"]:::stream
            nats_gtfs_rt["`*GTFS_RT_2* stream`"]:::stream
            classDef stream fill:#ffffde,stroke:#aaaa33
        end
        subgraph services[ ]
            gtfs_rt_feed(OpenDataVBB/gtfs-rt-feed)
            nats_consuming_gtfs_rt_server(OpenDataVBB/nats-consuming-gtfs-rt-server)
        end
        style services fill:none,stroke:none
    end
    style gtfs_rt_converter fill:none,stroke:#999999

    vdv_453_api-- VDV-453/-454 data -->vdv_453_nats_adapter
    nats_aus_istfahrt-- "`VDV-454 *AUS* *IstFahrt* messages`" -->gtfs_rt_feed
    gtfs_rt_feed-- "`GTFS-RT messages`" -->nats_gtfs_rt
    nats_gtfs_rt-- "`GTFS-RT messages`" -->nats_consuming_gtfs_rt_server
    nats_consuming_gtfs_rt_server-- combined GTFS-RT feed -->consumers
```

> [!NOTE]
> The password required to decrypt the [Ansible-Vault](https://docs.ansible.com/ansible/10/cli/ansible-vault.html)-encrypted secrets in this repository must be in a plain text file at `~/.vault-passwords/vbb-gtfs-rt-infrastructure.private`.

## VDV-453 proxy machines

> [!NOTE]
> Ansible group: `vdv_453_proxy`

These two (staging & production) machines will act as "proxies" (in a logical sense, not in a technical sense) between VBB's VDV-453 API and the machines converting the data to GTFS-RT.

They are VPSes hosted at [Planetary Networks](https://www.planetary-networks.de). They can be administered using their [management UI](https://console.planetary-networks.de:8800/).

## VDV-453 -> GTFS-RT conversion machines

> [!NOTE]
> Ansible group: `gtfs_rt_converter`

These machines convert VDV-453 data, convert it into the GTFS-RT format, and serve the GTFS-RT feeds via HTTP.

> [!TIP]
> Currently, the production machine `vbb_gtfs_rt_production` does not exist yet.
