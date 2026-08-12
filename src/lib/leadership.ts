import bishop from "@/assets/bishop-justin-marcus.webp";
import coPastor from "@/assets/copastor-brandi-marcus.webp";

export type Leader = {
  slug: string;
  /** Display name of the page itself, used for the title and nav links. */
  pageName: string;
  name: string;
  role: string;
  /** One-line summary for the index card and page meta description. */
  summary: string;
  photo: string;
  photoWidth: number;
  photoHeight: number;
  bio: string[];
};

export const LEADERS: Leader[] = [
  {
    slug: "bishop-justin-marcus",
    pageName: "Our Sr. Pastor",
    name: "Bishop Dr. Justin O. Marcus",
    role: "Sr. Pastor",
    summary:
      "Founding Pastor of Christ Cathedral Apostolic Church and District Bishop of the Greater Maryland District.",
    photo: bishop,
    photoWidth: 1024,
    photoHeight: 1536,
    bio: [
      "Bishop Dr. Justin Marcus is a native of Silver Spring, Maryland, born on November 12th to the union of Bishop Joseph and First Lady Nestle Marcus. He was baptized in the name of the Lord Jesus at the age of 4 and received the gift of the Holy Ghost with the evidence of speaking in other tongues at the age of 6. He received his fundamental teachings on the Apostolic Doctrine and the mighty God in Christ under the tutelage of Presiding Bishop Charles E. Johnson.",
      "He began his preaching ministry at the age of 11, preaching on the streets of Bowie, Maryland, compelling men to come to Christ and to hear the message of repentance. He went on to serve in many capacities within his father's ministry — Youth Pastor, Minister of Music, and Assistant Pastor. He received his formal training from Aenon Bible College, and pursued his bachelor's and master's degrees from Rowe Bible College, where he would also receive his Doctor of Ministry.",
      "Ordained Elder and appointed Pastor in mid-2011, he served as a local Pastor until 2016, when he became the founding Pastor of New Foundation Apostolic Ministries of Laurel. He served faithfully in Laurel from the summer of 2016 until the Lord led him to relocate the ministry to Baltimore, where the church was renamed Christ Cathedral Apostolic Church. God smiled on the ministry and allowed them to outgrow their first location and transition to their second home in Baltimore.",
      "Serving the Lord's Church faithfully he was selected to serve in the capacity of an Overseer and stayed in that role from Spring of 2016 until July of 2022 when he was Consecrated a Bishop in the Lord's Church by the Joint Board of Bishops of International Bible Way Church of Jesus Christ, where he serves as the District Bishop of the Greater Maryland District. Also serving the Northeast Regional Diocese as the Secretary of the Board of Bishops. In the spring of 2026 he was appointed by Presiding Bishop Vincent L. Greaves to serve as the 2nd Assistant Administrative Bishop of International Bible Way Church of Jesus Christ. He also serves as the founder and Presiding Bishop of the Christ Covenant Network, and he currently covers several churches throughout the United States of America.",
      "He is a well-sought after Evangelist, whose traveling ministry has led him across the length and breadth of this country. Preaching and carrying the Gospel of Christ where the Lord may lead him and his family to share tidings of great joy. He currently holds 3 earned degrees, and one honorary degree. He is the President of Excel and Edify Biblical Institution founded in 2023 as a resource for all to come and be educated and grow in the knowledge of Christ, serving as an accredited theological seminary it serves its students as a wealth of knowledge to those who attend. In the spring of 2025 he was accepted into Candler School of Theology in Atlanta, GA. He is also a successful author of 2 published written works.",
      "In fall of 2018 he met the love of his life Brandi Autry-Marcus, they went on in the summer of 2021 to get married. The bonds of their love are the chords by which Bishop Marcus attributes a great deal of the success of his ministry to. They are the loving parents of 3 wonderful children, Nyra Justinae, Paris Toi and King Pierre.",
    ],
  },
  {
    slug: "brandi-marcus",
    pageName: "Our Co-Pastor",
    name: "First Lady Brandi Marcus",
    role: "Co-Pastor",
    summary:
      "Co-Pastor, preacher, author of “Patterns of Prayer,” and entrepreneur across the greater Baltimore area.",
    photo: coPastor,
    photoWidth: 1115,
    photoHeight: 1982,
    bio: [
      "First Lady Brandi Marcus is a devoted wife, loving mother, entrepreneur, preacher, author, and leader in ministry. She is the wife of Bishop Justin Marcus and the proud mother of three beautiful children: Nyra, Paris, and King. As a woman of great faith, virtue, and dedication, she has become an example of excellence both in ministry and in business.",
      "From the early days of her salvation she demonstrated a passion for sharing the Gospel. She could often be found witnessing, encouraging others, and winning souls to Christ. Her burden for people and passion for evangelism made her a fruitful soul winner and created the pathway for her growth and advancement in ministry.",
      "She is also known for her unwavering dedication to prayer. Prayer has been one of the foundational pillars of her life and ministry, and she has inspired many through her consistency, discipline, and devotion in seeking God. Her passion for intercession and spiritual growth has led her to write several powerful manuscripts and teachings designed to strengthen believers. Among her most notable works is “Patterns of Prayer,” which highlights biblical principles and practical strategies for developing a powerful prayer life. She is also the creator of the masterclass “Diligent Division,” designed to help believers rightly divide the Word of God.",
      "In addition to her ministry work, she is a successful entrepreneur. She owns several thriving businesses throughout the greater Baltimore area and is recognized as a high-ticket real estate agent. Her business success reflects her discipline, work ethic, and commitment to excellence in every area of her life.",
      "First Lady Marcus has been preaching the Gospel since the spring of 2022. Her ministry is marked by power, compassion, authenticity, and a genuine love for God's people. She serves faithfully as Co-Pastor of Christ Cathedral Apostolic Church alongside her husband, helping to lead, disciple, and encourage the congregation. In 2025, during the 68th Holy Convocation of the International Bible Way Church of Jesus Christ, she was ordained to the office of Elder at the hands of Apostle Vincent L. Greaves Sr. and Bishop Justin Marcus.",
      "First Lady Brandi Marcus is a woman of character, integrity, wisdom, grace, and prayer. Through her life, she continues to inspire others to pursue God wholeheartedly, serve faithfully, and walk boldly in their purpose.",
    ],
  },
];

export function getLeader(slug: string): Leader | undefined {
  return LEADERS.find((l) => l.slug === slug);
}
