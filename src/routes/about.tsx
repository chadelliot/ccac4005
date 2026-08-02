import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import bishop from "@/assets/bishop-justin-marcus.webp";
import coPastor from "@/assets/copastor-brandi-marcus.webp";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — Christ Cathedral Apostolic Church" },
      { name: "description", content: "Learn about Christ Cathedral Apostolic Church, our mission, beliefs, and apostolic ministry in Baltimore." },
      { property: "og:title", content: "About CCAC" },
      { property: "og:description", content: "Apostolic ministry, rooted in the Word, empowered by the Holy Ghost." },
    ],
  }),
  component: AboutPage,
});

const BISHOP_BIO = [
  "Bishop Dr. Justin Marcus is a native of Silver Spring, Maryland, born on November 12th to the union of Bishop Joseph and First Lady Nestle Marcus. He was baptized in the name of the Lord Jesus at the age of 4 and received the gift of the Holy Ghost with the evidence of speaking in other tongues at the age of 6. He received his fundamental teachings on the Apostolic Doctrine and the mighty God in Christ under the tutelage of Presiding Bishop Charles E. Johnson.",
  "He began his preaching ministry at the age of 11, preaching on the streets of Bowie, Maryland, compelling men to come to Christ and to hear the message of repentance. He went on to serve in many capacities within his father's ministry — Youth Pastor, Minister of Music, and Assistant Pastor. He received his formal training from Aenon Bible College, and pursued his bachelor's and master's degrees from Rowe Bible College, where he would also receive his Doctor of Ministry.",
  "Ordained Elder and appointed Pastor in mid-2011, he served as a local Pastor until 2016, when he became the founding Pastor of New Foundation Apostolic Ministries of Laurel. He served faithfully in Laurel from the summer of 2016 until the Lord led him to relocate the ministry to Baltimore, where the church was renamed Christ Cathedral Apostolic Church. God smiled on the ministry and allowed them to outgrow their first location and transition to their second home in Baltimore.",
  "He served as an Overseer from the spring of 2016 until July of 2022, when he was consecrated a Bishop by the Joint Board of Bishops of International Bible Way Church of Jesus Christ. He serves as District Bishop of the Greater Maryland District, Secretary of the Board of Bishops for the Northeast Regional Diocese, and as a Special Assistant in the cabinet of the Office of the Executive Secretary. In the spring of 2026 he was appointed by Presiding Bishop Vincent L. Greaves to serve as Dean and Bishop of Protocol of International Bible Way Church of Jesus Christ.",
  "He is a well-sought-after evangelist whose traveling ministry has led him across the length and breadth of this country. He currently holds three earned degrees and one honorary degree, and is President of Excel and Edify Biblical Institution, founded in 2023 as an accredited theological seminary. In the spring of 2025 he was accepted into Candler School of Theology in Atlanta, Georgia. He is also the author of two published works.",
  "In the fall of 2018 he met the love of his life, Brandi Autry-Marcus; they married in the summer of 2021. Bishop Marcus attributes a great deal of the success of his ministry to the bonds of their love. They are the parents of three children: Nyra Justinae, Paris Toi, and King Pierre.",
];

const CO_PASTOR_BIO = [
  "First Lady Brandi Marcus is a devoted wife, loving mother, entrepreneur, preacher, author, and leader in ministry. She is the wife of Bishop Justin Marcus and the proud mother of three beautiful children: Nyra, Paris, and King. As a woman of great faith, virtue, and dedication, she has become an example of excellence both in ministry and in business.",
  "From the early days of her salvation she demonstrated a passion for sharing the Gospel. She could often be found witnessing, encouraging others, and winning souls to Christ. Her burden for people and passion for evangelism made her a fruitful soul winner and created the pathway for her growth and advancement in ministry.",
  "She is also known for her unwavering dedication to prayer. Prayer has been one of the foundational pillars of her life and ministry, and she has inspired many through her consistency, discipline, and devotion in seeking God. Her passion for intercession and spiritual growth has led her to write several powerful manuscripts and teachings designed to strengthen believers. Among her most notable works is “Patterns of Prayer,” which highlights biblical principles and practical strategies for developing a powerful prayer life. She is also the creator of the masterclass “Diligent Division,” designed to help believers rightly divide the Word of God.",
  "In addition to her ministry work, she is a successful entrepreneur. She owns several thriving businesses throughout the greater Baltimore area and is recognized as a high-ticket real estate agent. Her business success reflects her discipline, work ethic, and commitment to excellence in every area of her life.",
  "First Lady Marcus has been preaching the Gospel since the spring of 2022. Her ministry is marked by power, compassion, authenticity, and a genuine love for God's people. She serves faithfully as Co-Pastor of Christ Cathedral Apostolic Church alongside her husband, helping to lead, disciple, and encourage the congregation. In 2025, during the 68th Holy Convocation of the International Bible Way Church of Jesus Christ, she was ordained to the office of Elder at the hands of Apostle Vincent L. Greaves Sr. and Bishop Justin Marcus.",
  "First Lady Brandi Marcus is a woman of character, integrity, wisdom, grace, and prayer. Through her life, she continues to inspire others to pursue God wholeheartedly, serve faithfully, and walk boldly in their purpose.",
];

function Leader({
  photo,
  name,
  role,
  bio,
  reverse = false,
}: {
  photo: string;
  name: string;
  role: string;
  bio: string[];
  reverse?: boolean;
}) {
  return (
    <div className="grid gap-10 lg:grid-cols-5 lg:gap-14 items-start">
      <div className={`lg:col-span-2 ${reverse ? "lg:order-2" : ""}`}>
        <img
          src={photo}
          alt={`${name}, ${role} of Christ Cathedral Apostolic Church`}
          className="w-full object-cover"
          loading="lazy"
        />
      </div>
      <div className={`lg:col-span-3 ${reverse ? "lg:order-1" : ""}`}>
        <div className="eyebrow text-accent mb-3">{role}</div>
        <h3 className="font-display text-4xl mb-6">{name}</h3>
        <div className="space-y-4">
          {bio.map((p, i) => (
            <p key={i} className="text-muted-foreground leading-relaxed">
              {p}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

function AboutPage() {
  return (
    <div className="bg-background text-foreground">
      <div className="bg-night text-night-foreground pt-32 pb-24">
        <SiteHeader />
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <div className="eyebrow text-gold mb-6">— About</div>
          <h1 className="display-hero text-6xl lg:text-8xl">Our Story</h1>
        </div>
      </div>

      <section className="py-24 lg:py-32">
        <div className="mx-auto max-w-3xl px-6 lg:px-10">
          <p className="text-xl leading-relaxed text-muted-foreground">
            Christ Cathedral Apostolic Church is a thriving apostolic ministry in the heart of
            Baltimore with a passion to see lives transformed by the power of Jesus Christ. We are
            committed to preaching truth, building strong disciples, and creating an atmosphere
            where people can encounter God in a real and life-changing way.
          </p>

          <h2 className="font-display text-4xl mt-16 mb-6">Our Mission</h2>
          <p className="text-muted-foreground leading-relaxed">
            To reach souls, restore families, and raise up believers who are rooted in the Word of
            God and empowered by the Holy Ghost. We believe that church is more than a service — it
            is a community of faith where people from every background can grow spiritually,
            discover purpose, and become everything God has called them to be.
          </p>

          <h2 className="font-display text-4xl mt-16 mb-6">What We Believe</h2>
          <p className="text-muted-foreground leading-relaxed">
            We hold to the apostolic doctrine — repentance from sin, water baptism in the name of
            Jesus Christ for the remission of sins, and the infilling of the Holy Ghost with the
            evidence of speaking in tongues, just as the Church received on the day of Pentecost.
          </p>

          <p className="text-muted-foreground leading-relaxed mt-8">
            Whether you are new to church, returning to your faith, or looking for a place to grow
            deeper in God, Christ Cathedral is a place where you can belong, be loved, and be
            transformed.
          </p>
        </div>
      </section>

      <section className="pb-24 lg:pb-32">
        <div className="mx-auto max-w-6xl px-6 lg:px-10">
          <div className="eyebrow text-accent mb-12">— Our Leadership</div>
          <div className="space-y-24">
            <Leader
              photo={bishop}
              name="Bishop Dr. Justin O. Marcus"
              role="Pastor"
              bio={BISHOP_BIO}
            />
            <Leader
              photo={coPastor}
              name="First Lady Brandi Marcus"
              role="Co-Pastor"
              bio={CO_PASTOR_BIO}
              reverse
            />
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
