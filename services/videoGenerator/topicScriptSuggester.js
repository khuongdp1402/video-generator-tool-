'use strict';

/**
 * Curated high-retention Topic & Script Suggestion Engine for all 8 Video Styles.
 * Supports:
 *  1. Picking a pre-built topic per style (with multiple dynamic hook/body variants)
 *  2. Generating a complete viral script + visual prompts from any custom topic keyword
 *  3. Generating both Single Script and Batch Multi-line Prompts
 */

const STYLE_TOPIC_CATALOG = {
  psych_split: {
    kind: 'psych_split',
    label: '🧠 Tâm lý học Lành Tâm (3 tầng)',
    defaultChannel: 'LÀNH TÂM',
    topics: [
      {
        id: 'habitual_contradiction',
        badge: '🔥 Viral 3.2M views',
        title: 'Tính Cách Phản Bác Thường Trực',
        videoTitle: 'TÍNH CÁCH PHẢN BÁC',
        summary: 'Kiểu người luôn mở miệng bằng hai chữ "Không phải", thích bắt bẻ mọi thứ để che giấu sự tự ti.',
        lessonText: 'Nhận diện cơ chế phòng vệ tâm lý để giữ bình an và không cuốn vào tranh cãi vô bổ.',
        scripts: [
          'Trong cuộc sống có một kiểu người luôn thích mở miệng bằng hai chữ: Không phải. Bạn nói hôm nay trời đẹp, họ liền đáp nắng thế này mà đẹp gì, tia cực tím mạnh lắm. Trong tâm lý học, đây gọi là tính cách phản bác thường trực (Habitual Contradiction). Họ dùng sự phủ định người khác như một chiếc khiên vô hình để che giấu sự bất an và khẳng định quyền kiểm soát.',
          'Có bao giờ bạn gặp một người mà bất cứ câu nào bạn nói ra, phản xạ đầu tiên của họ là cãi lại chưa? Dù bạn nói điều hiển nhiên nhất, họ vẫn bới móc được một góc oái oăm để phủ nhận. Tâm lý học gọi đây là hội chứng phản bác tự động (Automatic Negation). Đằng sau cái tôi hiếu thắng đó thực chất là một nội tâm rỗng tuếch, chỉ thấy mình tồn tại khi hạ thấp góc nhìn của người khác.'
        ],
        batchLines: [
          'Kiểu người luôn mở miệng bằng hai chữ Không phải thực chất đang che giấu sự tự ti sâu sắc (Habitual Contradiction).',
          'Tại sao người hay bắt bẻ từng lời nói của bạn lại chính là người sợ bị bỏ rơi và thiếu cảm giác an toàn nhất?',
          'Cách đối phó thông minh nhất với người có tính cách phản bác: Mỉm cười gật đầu và để họ tự độc thoại.'
        ]
      },
      {
        id: 'gaslighting_trap',
        badge: '⚡ Giữ chân 94%',
        title: 'Thao Túng Tâm Lý (Gaslighting)',
        videoTitle: 'BẪY THAO TÚNG TÂM LÝ',
        summary: 'Cách kẻ thao túng bóp méo sự thật khiến nạn nhân tự nghi ngờ trí nhớ và sự tỉnh táo của chính mình.',
        lessonText: 'Tin vào trực giác của chính mình và rời khỏi những mối quan hệ bắt bạn phải xin lỗi vì cảm xúc thật.',
        scripts: [
          'Nếu một người làm bạn tổn thương, nhưng cuối cùng chính bạn lại là người phải đi xin lỗi họ, bạn đã rơi vào bẫy thao túng tâm lý (Gaslighting). Họ luôn dùng những câu như: Em nhạy cảm quá rồi, hay Anh chỉ đùa thôi mà. Từng chút một, họ xóa sạch ranh giới đúng sai, khiến bạn tự nghi ngờ chính trí nhớ và giá trị của bản thân mình.',
          'Dấu hiệu nguy hiểm nhất của thao túng tâm lý (Gaslighting) không phải là tiếng quát tháo, mà là sự phủ nhận êm ái. Họ biến lỗi lầm của họ thành sự đa nghi của bạn. Khi bạn bắt đầu tự hỏi liệu mình có quá đáng không, đó là lúc chiếc lồng vô hình đã khóa chặt.'
        ],
        batchLines: [
          'Dấu hiệu bạn đang bị thao túng tâm lý (Gaslighting): Người làm sai là họ nhưng người xin lỗi luôn là bạn.',
          'Ba câu cửa miệng của kẻ thao túng cảm xúc: Do bạn nghĩ nhiều quá, Tôi làm vậy chỉ vì muốn tốt cho bạn.',
          'Cách phá vỡ chiếc lồng thao túng tâm lý: Ghi nhận sự thật khách quan và ngừng tìm kiếm sự công nhận từ họ.'
        ]
      },
      {
        id: 'silent_treatment',
        badge: '🧠 Tâm lý quan hệ',
        title: 'Bạo Lực Lạnh (Silent Treatment)',
        videoTitle: 'Đòn Trừng Phạt Im Lặng',
        summary: 'Sự im lặng độc hại trong mối quan hệ không phải để bình tĩnh, mà là vũ khí kiểm soát tinh thần.',
        lessonText: 'Im lặng để bình tĩnh là trưởng thành, nhưng im lặng để trừng phạt là bạo lực tinh thần.',
        scripts: [
          'Đừng nhầm lẫn giữa người cần không gian để bình tĩnh và kẻ đang dùng sự im lặng để trừng phạt bạn. Trong tâm lý học, bạo lực lạnh (Silent Treatment) là hình thức thao túng tàn nhẫn nhất không để lại vết thương ngoài da. Kẻ im lặng cố tình rút toàn bộ sự chú ý để đẩy bạn vào cơn hoảng loạn bị bỏ rơi, buộc bạn phải hạ mình cầu xin trước.',
          'Một người trưởng thành sẽ nói: Anh cần một tiếng để bình tĩnh rồi mình nói tiếp. Còn kẻ dùng bạo lực lạnh (Silent Treatment) sẽ biến mất hoàn toàn, coi bạn như người vô hình. Sự im lặng đó không phải vì họ hết lời, mà vì họ muốn nhìn thấy bạn suy sụp.'
        ],
        batchLines: [
          'Sự khác biệt giữa im lặng để bình tĩnh và bạo lực lạnh độc hại (Silent Treatment) trong tình yêu.',
          'Vì sao bạo lực lạnh lại kích hoạt vùng đau đớn trên não bộ giống hệt như một vết thương thể xác?',
          'Đừng bao giờ chạy theo van xin một người cố tình dùng sự im lặng để trừng phạt cảm xúc của bạn.'
        ]
      },
      {
        id: 'fawn_response',
        badge: '💡 Chữa lành sâu',
        title: 'Hội Chứng Làm Hài Lòng (People Pleasing)',
        videoTitle: 'HỘI CHỨNG LÀM HÀI LÒNG',
        summary: 'Vì sao bạn luôn sợ nói lời từ chối và đặt cảm xúc của thiên hạ lên trên nỗi đau của chính mình?',
        lessonText: 'Lòng tốt không có ranh giới sẽ biến thành sự tự hủy hoại bản thân.',
        scripts: [
          'Bạn không phải là người quá tốt bụng, bạn chỉ đang mắc kẹt trong phản xạ xu nịnh do sang chấn (Fawn Response). Ngay từ nhỏ, bạn đã học cách đọc sắc mặt người khác để được an toàn. Lớn lên, bạn không dám nói chữ Không vì sợ bị ghét bỏ. Nhưng càng cố làm vừa lòng tất cả mọi người, người duy nhất bị phản bội lại chính là bản thân bạn.',
          'Tại sao bạn luôn cảm thấy kiệt sức sau mỗi cuộc gặp gỡ? Bởi vì bạn đang đóng vai một người hoàn hảo để chiều lòng thiên hạ (People Pleasing). Trong tâm lý học, khi lòng tốt không đi kèm ranh giới, người khác sẽ coi sự hy sinh của bạn là nghĩa vụ hiển nhiên.'
        ],
        batchLines: [
          'Phản xạ làm hài lòng người khác (Fawn Response) thực chất là cơ chế sinh tồn từ những tổn thương thời thơ ấu.',
          'Ba dấu hiệu cho thấy sự tử tế của bạn đang bị người khác lợi dụng như một nghĩa vụ hiển nhiên.',
          'Học cách nói chữ Không dứt khoát chính là bước đầu tiên để lấy lại sự tôn trọng trong mọi mối quan hệ.'
        ]
      },
      {
        id: 'crab_mentality',
        badge: '🔥 Xu hướng TikTok',
        title: 'Hiệu Ứng Con Cua (Crab Mentality)',
        videoTitle: 'TÂM LÝ ĐÀN CUA',
        summary: 'Những người xung quanh không sợ bạn khổ, họ chỉ sợ bạn vươn lên giỏi hơn và giàu hơn họ.',
        lessonText: 'Giữ kín mục tiêu lớn và chọn đúng môi trường những người nâng bạn lên.',
        scripts: [
          'Khi bạn thả một con cua vào xô, nó có thể tự bò ra ngoài. Nhưng khi thả một đàn cua vào chung một xô, không con nào thoát được, vì bất cứ con nào trèo lên đều bị những con bên dưới kéo chân tụt xuống. Tâm lý học gọi đó là tư duy đàn cua (Crab Mentality). Nhiều người quanh bạn rất thương bạn khi bạn thất bại, nhưng lại lập tức khó chịu khi thấy bạn đổi đời.',
          'Đừng ngạc nhiên khi bạn bắt đầu kỷ luật hơn, kiếm được nhiều tiền hơn, thì những lời giễu cợt đầu tiên lại đến từ người quen. Đó là hiệu ứng đàn cua (Crab Mentality). Sự tiến bộ của bạn vô tình trở thành tấm gương phản chiếu sự dậm chân tại chỗ của họ.'
        ],
        batchLines: [
          'Hiệu ứng đàn cua (Crab Mentality): Tại sao nhiều người quen chỉ thích nhìn thấy bạn bình thường như họ?',
          'Bí mật tâm lý đằng sau những lời khuyên can giả tạo khi bạn bắt đầu khởi nghiệp hoặc thay đổi bản thân.',
          'Muốn bay cao, hãy lặng lẽ rời khỏi chiếc xô của những người chỉ quen kéo chân nhau xuống.'
        ]
      },
      {
        id: 'dunning_kruger',
        badge: '🧠 Tâm lý nhận thức',
        title: 'Đỉnh Núi Ngu Dốt (Dunning-Kruger)',
        videoTitle: 'ĐỈNH NÚI NGU DỐT',
        summary: 'Vì sao người càng biết ít lại càng tự tin thái quá, còn chuyên gia thực thụ lại luôn khiêm nhường?',
        lessonText: 'Sự khiêm tốn là khởi đầu của trí tuệ thật sự; thùng rỗng mới thường kêu to.',
        scripts: [
          'Tại sao những người mới đọc vài trang sách lại thích dạy đời thiên hạ, trong khi những bậc thầy thực sự lại luôn im lặng lắng nghe? Đó chính là hiệu ứng tâm lý Dunning-Kruger. Người có năng lực càng thấp thì lại càng đứng trên đỉnh núi của sự tự tin mù quáng (Mount Stupid), vì họ thậm chí không đủ kiến thức để nhận ra mình đang sai ở đâu.',
          'Trong bất kỳ cuộc tranh luận nào, người nói to nhất và khẳng định chắc nịch nhất thường là người hiểu biết nông cạn nhất. Hiệu ứng Dunning-Kruger chỉ ra rằng: Sự thiếu hiểu biết tạo ra cảm giác tự tin nhanh hơn rất nhiều so với tri thức thực tế.'
        ],
        batchLines: [
          'Hiệu ứng Dunning-Kruger: Tại sao người càng hiểu biết nông cạn lại càng thích dạy đời người khác?',
          'Bốn giai đoạn phát triển trí tuệ: Từ Đỉnh núi ngu dốt đến Thung lũng tuyệt vọng và Cao nguyên bền vững.',
          'Cách nhận diện một chuyên gia thật sự chỉ qua ba phút lắng nghe cách họ trả lời câu hỏi khó.'
        ]
      }
    ]
  },

  pictogram: {
    kind: 'pictogram',
    label: '🕴️ Pictogram Đen Trắng',
    defaultChannel: 'TƯ DUY THỰC CHIẾN',
    topics: [
      {
        id: 'rat_race_escape',
        badge: '🔥 Viral 4.1M views',
        title: 'Vòng Xoay Chuột Chạy (Rat Race)',
        videoTitle: 'BẪY VÒNG XOAY LƯƠNG THÁNG',
        summary: 'Cơ chế khiến 95% người đi làm bán thời gian lấy tiền rồi lại dùng tiền mua thứ tiêu sản.',
        lessonText: 'Tự do tài chính bắt đầu khi bạn mua tài sản sinh dòng tiền thay vì mua sĩ diện.',
        scripts: [
          'Chào mừng bạn đến với chiếc lồng êm ái nhất thế giới mang tên: Lương tháng cố định. Mỗi sáng bạn thức dậy lúc bảy giờ, bán tám tiếng cuộc đời để đổi lấy một con số trong tài khoản. Rồi cuối tuần, bạn lại vội vã tiêu sạch số tiền đó vào quần áo, điện thoại trả góp để tự thưởng cho sự mệt mỏi. Đó là vòng xoay chuột chạy (Rat Race), nơi bạn chạy càng nhanh thì chiếc lồng càng quay tít.',
          'Tại sao lương của bạn tăng gấp đôi sau năm năm nhưng tài khoản tiết kiệm vẫn bằng không? Bởi vì ngay khi thu nhập vừa nhích lên, bạn đã lập tức nâng cấp mức sống để khoe với những người bạn thậm chí chẳng ưa gì. Đó gọi là lạm phát lối sống (Lifestyle Inflation).'
        ],
        batchLines: [
          'Vòng xoay chuột chạy (Rat Race): Cách 95% người trẻ tự khóa mình vào hóa đơn trả góp mỗi tháng.',
          'Lạm phát lối sống (Lifestyle Inflation) đang âm thầm đánh cắp mười năm tự do tài chính của bạn như thế nào?',
          'Quy tắc tách ba mươi phần trăm thu nhập mua tài sản trước khi tiêu bất kỳ đồng nào cho bản thân.'
        ]
      },
      {
        id: 'dopamine_detox',
        badge: '⚡ Giữ chân 95%',
        title: 'Bẫy Dopamine Giá Rẻ',
        videoTitle: 'CAI NGHIỆN DOPAMINE RẺ TIỀN',
        summary: 'Cách thuật toán video ngắn làm tê liệt khả năng tập trung và biến não bộ thành nô lệ của khoái cảm tức thời.',
        lessonText: 'Kiểm soát sự chú ý của bản thân chính là siêu năng lực đắt giá nhất thời đại số.',
        scripts: [
          'Bộ não của bạn đang bị đánh cắp từng giây mà bạn không hề hay biết. Mỗi cú lướt màn hình chưa tới ba giây lại bơm vào não một liều Dopamine giá rẻ (Cheap Dopamine). Khi não đã quen với phần thưởng tức thời không cần nỗ lực, bạn sẽ thấy đọc một trang sách hay làm việc sâu trở nên chán ngắt. Ai làm chủ được sự nhàm chán, người đó mới làm chủ được cuộc đời.',
          'Bạn không hề lười biếng, hệ thống thần kinh của bạn chỉ đang bị quá tải Dopamine. Hãy thử rời xa điện thoại ba mươi phút đầu tiên mỗi sáng, bạn sẽ thấy khả năng tập trung và ý chí hành động quay trở lại mạnh mẽ đến bất ngờ.'
        ],
        batchLines: [
          'Dopamine giá rẻ (Cheap Dopamine) đang phá hủy khả năng tập trung sâu của não bộ như thế nào?',
          'Tại sao người thành công luôn bảo vệ sáu mươi phút đầu tiên sau khi thức dậy khỏi màn hình điện thoại?',
          'Ba bước thanh lọc Dopamine (Dopamine Detox) trong bảy ngày để khôi phục kỷ luật thép.'
        ]
      },
      {
        id: 'pareto_80_20',
        badge: '📈 Hiệu suất x10',
        title: 'Quy Luật 80/20 Trong Kiếm Tiền',
        videoTitle: 'QUY LUẬT 80/20 THỰC CHIẾN',
        summary: '20% hành động cốt lõi tạo ra 80% thu nhập, nhưng đa số lại đốt 100% sức lực vào việc vặt.',
        lessonText: 'Đừng nhầm lẫn giữa sự bận rộn và sự hiệu quả; hãy cắt bỏ 80% việc vô nghĩa.',
        scripts: [
          'Làm việc mười hai tiếng mỗi ngày không giúp bạn giàu lên, nếu mười tiếng trong đó là những việc lặt vặt không tạo ra đòn bẩy. Quy luật Pareto chỉ rõ: Hai mươi phần trăm quyết định cốt lõi sẽ mang lại tám mươi phần trăm kết quả (Pareto Principle). Người thông minh không cố làm nhiều việc hơn, họ tàn nhẫn gạch bỏ tám mươi phần trăm việc vô bổ để dồn toàn lực vào một điểm đột phá.',
          'Hãy nhìn lại danh sách công việc hôm nay của bạn. Chỉ có đúng một hoặc hai việc thực sự mang lại tiền bạc và sự thăng tiến, phần còn lại chỉ là sự bận rộn giả tạo để trấn an lương tâm mà thôi.'
        ],
        batchLines: [
          'Sự khác biệt giữa người bận rộn cả đời và người nắm giữ quy luật đòn bẩy 80/20 (Pareto Principle).',
          'Cách tìm ra hai mươi phần trăm công việc cốt lõi tạo ra tám mươi phần trăm dòng tiền của bạn.',
          'Nghệ thuật từ chối những việc vặt ngốn thời gian để tập trung vào mục tiêu sống còn.'
        ]
      },
      {
        id: 'sunk_cost_fallacy',
        badge: '🧠 Kinh tế hành vi',
        title: 'Ngụy Biện Chi Phí Chìm (Sunk Cost)',
        videoTitle: 'CÁI BẪY TIẾC CÔNG SỨC CŨ',
        summary: 'Vì sao con người thà chịu lỗ thêm nhiều năm chứ không dám cắt bỏ một dự án hay mối quan hệ đã hỏng?',
        lessonText: 'Biết dừng lại đúng lúc không phải là bỏ cuộc, mà là cắt lỗ để bảo toàn tương lai.',
        scripts: [
          'Tại sao bạn biết rõ một bộ phim rất dở nhưng vẫn cố ngồi xem hết chỉ vì đã lỡ mua vé? Tại sao bạn biết một mối quan hệ đã mục nát nhưng vẫn cố chịu đựng chỉ vì tiếc năm năm thanh xuân? Đó là ngụy biện chi phí chìm (Sunk Cost Fallacy). Đừng vì tiếc một tấm vé mua nhầm mà đánh đổi cả phần đời còn lại trên chuyến tàu đi sai hướng.',
          'Kẻ thất bại giữ khư khư những gì đã mất, còn người bản lĩnh chỉ nhìn vào giá trị của ngày mai. Chi phí đã chìm xuống đáy biển thì không bao giờ lấy lại được, cố lao theo chỉ khiến bạn chìm cùng nó mà thôi.'
        ],
        batchLines: [
          'Ngụy biện chi phí chìm (Sunk Cost Fallacy): Lý do khiến người thông minh vẫn mắc kẹt trong sai lầm nhiều năm.',
          'Quy tắc cắt lỗ dứt khoát trong đầu tư, sự nghiệp và các mối quan hệ độc hại.',
          'Nếu hôm nay được chọn lại từ đầu, bạn có bước vào công việc hay mối quan hệ hiện tại nữa không?'
        ]
      }
    ]
  },

  psych_surreal: {
    kind: 'psych_surreal',
    label: '🌌 Ẩn dụ Tâm lý Siêu thực',
    defaultChannel: 'GÓC KHUẤT NỘI TÂM',
    topics: [
      {
        id: 'carl_jung_shadow',
        badge: '🌌 Carl Jung',
        title: 'Bóng Tối Nội Tâm (The Shadow)',
        videoTitle: 'ĐỐI DIỆN PHẦN BÓNG TỐI',
        summary: 'Những gì bạn ghét cay ghét đắng ở người khác thường chính là phần bản ngã bị bạn đè nén sâu trong vô thức.',
        lessonText: 'Khi bạn chấp nhận phần bóng tối của chính mình, không ai có thể dùng nó để làm tổn thương bạn.',
        scripts: [
          'Nhà tâm lý học Carl Jung từng nói: Cho đến khi bạn biến vô thức thành ý thức, nó sẽ điều khiển cuộc đời bạn và bạn gọi đó là số phận. Mỗi chúng ta đều mang theo một cái bóng vô hình (The Shadow) chứa đựng những khao khát, cơn giận và sự yếu đuối bị giấu kín. Thứ khiến bạn chói mắt nhất ở người khác, đôi khi lại là mảnh gương phản chiếu phần bóng tối bạn chưa dám đối diện trong chính mình.',
          'Một cái cây muốn vươn ngọn chạm tới thiên đường thì rễ của nó phải đâm sâu xuống tận bóng tối dưới lòng đất. Sự trưởng thành thật sự không phải là trở nên hoàn hảo không tì vết, mà là ôm lấy cả ánh sáng lẫn bóng tối bên trong nội tâm.'
        ],
        batchLines: [
          'Khái niệm Bóng tối nội tâm (The Shadow) của Carl Jung: Vì sao bạn lại ghét một ai đó ngay từ cái nhìn đầu tiên?',
          'Cơ chế phóng chiếu tâm lý (Psychological Projection): Khi thế giới bên ngoài chỉ là tấm gương của nội tâm.',
          'Cách hợp nhất phần bóng tối để giải phóng nguồn năng lượng sáng tạo mạnh mẽ nhất trong bạn.'
        ]
      },
      {
        id: 'mask_persona',
        badge: '🎭 Siêu thực sâu lắng',
        title: 'Chiếc Mặt Nạ Xã Hội (The Persona)',
        videoTitle: 'KHI MẶT NẠ DÍNH LIỀN VÀO DA',
        summary: 'Bi kịch của người đeo mặt nạ mạnh mẽ quá lâu đến mức quên mất gương mặt thật của mình khi ở một mình.',
        lessonText: 'Hãy cho phép mình được yếu đuối và tháo chiếc mặt nạ xuống khi trở về với chính mình.',
        scripts: [
          'Ban ngày bạn là người vững vàng nhất trong mắt đồng nghiệp và gia đình, luôn mỉm cười nói câu: Tôi ổn. Nhưng khi cánh cửa phòng khép lại lúc nửa đêm, một sự trống rỗng mênh mông lập tức nuốt chửng lấy bạn. Đó là lúc chiếc mặt nạ xã hội (The Persona) đã đeo quá chặt vào khuôn mặt. Đừng để cả thế giới yêu quý một vai diễn, còn con người thật bên trong bạn lại chết dần vì cô độc.',
          'Có những nỗi mệt mỏi không đến từ công việc nặng nhọc, mà đến từ việc phải giả vờ vui vẻ suốt mười mấy tiếng mỗi ngày. Tháo mặt nạ xuống không làm bạn yếu đi, nó chỉ giúp tâm hồn bạn được thở thật sự.'
        ],
        batchLines: [
          'Hội chứng trầm cảm cười (Smiling Depression): Khi chiếc mặt nạ hoàn hảo che giấu một tâm hồn đang kiệt quệ.',
          'Sự đánh đổi giữa chiếc mặt nạ xã hội (The Persona) và bản체 chân thật bên trong mỗi con người.',
          'Làm sao để tìm lại chính mình sau nhiều năm sống theo kỳ vọng của gia đình và xã hội?'
        ]
      },
      {
        id: 'emotional_cage',
        badge: '🔥 Chạm cảm xúc',
        title: 'Chiếc Lồng Quá Khứ Không Khóa Cửa',
        videoTitle: 'CHIẾC LỒNG TỰ GIAM CẦM',
        summary: 'Cánh cửa chiếc lồng tổn thương đã mở từ lâu, nhưng nỗi sợ quen thuộc khiến bạn không dám bước ra.',
        lessonText: 'Quá khứ chỉ có quyền lực khi bạn tiếp tục sống lại nó trong tâm trí mỗi ngày.',
        scripts: [
          'Người làm tổn thương bạn năm đó đã sớm bước sang trang mới của cuộc đời họ, nhưng bạn vẫn tự nhốt mình trong căn phòng ký ức cũ kỹ để chịu phạt thay. Trong tâm lý học, đó là sự gắn kết với nỗi đau quen thuộc (Trauma Bonding). Cánh cửa chiếc lồng thực ra chưa bao giờ khóa, thứ giữ chân bạn ở lại chỉ là nỗi sợ phải làm quen với bầu trời tự do.',
          'Bạn không thể chữa lành vết thương nếu mỗi ngày đều tự tay cạy lớp vảy đang kéo da non để kiểm tra xem nó còn đau hay không. Hãy bước ra khỏi cơn mưa của ngày hôm qua.'
        ],
        batchLines: [
          'Tại sao não bộ lại nghiện cảm giác đau khổ quen thuộc hơn là một hạnh phúc mới mẻ chưa biết trước?',
          'Ẩn dụ chiếc lồng mở cửa: Khi người giam cầm bạn lâu nhất lại chính là suy nghĩ của bản thân.',
          'Ba bước cắt đứt sợi dây liên kết sang chấn (Trauma Bond) để trả tự do cho tâm trí.'
        ]
      }
    ]
  },

  minimalist: {
    kind: 'minimalist',
    label: '⚫ Tối giản Dan Koe',
    defaultChannel: 'MINIMAL MIND',
    topics: [
      {
        id: 'monk_mode_focus',
        badge: '⚫ Dan Koe Style',
        title: '6 Tháng Biến Mất (Monk Mode)',
        videoTitle: '6 THÁNG KỶ LUẬT TUYỆT ĐỐI',
        summary: 'Tắt thông báo, cắt bỏ tiệc tùng vô bổ và tập trung xây dựng 1 hệ thống cá nhân trong 180 ngày.',
        lessonText: 'Chỉ cần 6 tháng tập trung tuyệt đối, bạn sẽ vượt xa 5 năm sống vô định.',
        scripts: [
          'Đa số mọi người đánh giá quá cao những gì họ có thể làm trong một ngày, nhưng lại đánh giá quá thấp sức mạnh của sáu tháng biến mất hoàn toàn để tập trung. Chế độ tu sĩ (Monk Mode) rất đơn giản: Cắt bỏ tám mươi phần trăm các cuộc nhậu vô nghĩa, dành bốn tiếng mỗi ngày xây dựng kỹ năng cốt lõi và rèn luyện thể chất. Sau một trăm tám mươi ngày, bạn sẽ bước ra với một phiên bản mà chính bạn cũng không nhận ra.',
          'Sự phân tâm là kẻ thù lớn nhất của tự do. Khi bạn dồn toàn bộ năng lượng tinh thần vào một mục tiêu duy nhất mỗi ngày, thành công không còn là may mắn mà trở thành kết quả tất yếu của toán học.'
        ],
        batchLines: [
          'Chế độ Monk Mode: Công thức sáu tháng biến mất để tái thiết lập hoàn toàn sự nghiệp và tư duy.',
          'Bốn trụ cột của người có hiệu suất cực đại: Làm việc sâu bốn giờ, vận động thể chất, đọc sách và ngủ đủ.',
          'Tại sao sự cô độc có chủ đích lại là lò luyện tốt nhất cho những bước nhảy vọt về thu nhập?'
        ]
      },
      {
        id: 'one_person_business',
        badge: '💰 Kinh doanh 1 người',
        title: 'Doanh Nghiệp Một Người Thời Đại AI',
        videoTitle: 'ĐÒN BẨY DOANH NGHIỆP 1 NGƯỜI',
        summary: 'Cách biến kiến thức cá nhân, nội dung số và công cụ AI thành cỗ máy tạo thu nhập tự động.',
        lessonText: 'Trong kỷ nguyên AI, đòn bẩy lớn nhất là nội dung số và hệ thống tự động hóa.',
        scripts: [
          'Bạn không cần thuê năm mươi nhân viên hay mặt bằng đắt đỏ để xây dựng một sự nghiệp tự do. Trong kỷ nguyên số, mô hình doanh nghiệp một người (One-Person Business) kết hợp với trí tuệ nhân tạo cho phép một cá nhân vận hành bằng cả một công ty truyền thống. Hãy biến những vấn đề bạn đã tự giải quyết được thành nội dung giá trị, thu hút khán giả và đóng gói thành sản phẩm số hoạt động hai mươi bốn giờ mỗi ngày.',
          'Đòn bẩy không cần xin phép (Permissionless Leverage) gồm hai thứ: Nội dung truyền thông và phần mềm tự động. Khi bạn sở hữu cả hai, thời gian của bạn sẽ hoàn toàn tách rời khỏi giới hạn thu nhập.'
        ],
        batchLines: [
          'Mô hình Doanh nghiệp một người (One-Person Business): Cách tạo dòng tiền bền vững không cần quản lý nhân sự.',
          'Ba loại đòn bẩy giúp người bình thường bức phá trong kỷ nguyên AI: Nội dung, Code và Hệ thống.',
          'Cách biến kiến thức và trải nghiệm cá nhân thành tài sản số sinh lời ngay cả khi bạn đang ngủ.'
        ]
      }
    ]
  },

  handdrawn: {
    kind: 'handdrawn',
    label: '✏️ Vẽ tay 2D Explainer',
    defaultChannel: 'GIẢI MÃ 60 GIÂY',
    topics: [
      {
        id: 'compound_effect',
        badge: '✏️ Explainer Dễ Hiểu',
        title: 'Lãi Kép Của Thói Quen 1% Mỗi Ngày',
        videoTitle: 'SỨC MẠNH 1% MỖI NGÀY',
        summary: 'Toán học đằng sau việc tốt hơn 1% mỗi ngày giúp bạn mạnh hơn gấp 37 lần sau 1 năm.',
        lessonText: 'Thói quen nhỏ lặp lại mỗi ngày luôn chiến thắng những nỗ lực bốc đồng ngắn hạn.',
        scripts: [
          'Nếu mỗi ngày bạn chỉ tiến bộ thêm đúng một phần trăm, chuyện gì sẽ xảy ra sau một năm? Theo toán học, một phẩy không một mũ ba trăm sáu mươi lăm bằng ba mươi bảy phẩy tám. Nghĩa là bạn sẽ giỏi hơn gấp gần ba mươi tám lần so với ngày đầu tiên. Ngược lại, nếu mỗi ngày bạn buông thả một phần trăm, bạn sẽ tụt xuống gần bằng không. Đó là hiệu ứng lãi kép của thói quen (Compound Effect).',
          'Mọi thành tựu vĩ đại đều bắt đầu từ những bước nhỏ đến mức nực cười: Đọc năm trang sách, chạy bộ mười phút, viết một đoạn kịch bản. Đừng coi thường một phần trăm của ngày hôm nay, vì lãi kép đang âm thầm làm việc cho bạn.'
        ],
        batchLines: [
          'Toán học của sự kỷ luật: Tốt hơn một phần trăm mỗi ngày giúp bạn mạnh gấp ba mươi bảy lần sau một năm.',
          'Thung lũng thất vọng (Valley of Disappointment): Vì sao chín mươi phần trăm mọi người bỏ cuộc ngay trước khi lãi kép bùng nổ?',
          'Quy tắc hai phút giúp bạn bắt đầu bất kỳ thói quen khó nào mà không bị não bộ kháng cự.'
        ]
      },
      {
        id: 'feynman_technique',
        badge: '🧠 Học siêu tốc',
        title: 'Phương Pháp Học Siêu Tốc Feynman',
        videoTitle: 'TUYỆT CHIÊU HỌC NHANH FEYNMAN',
        summary: 'Cách nhà vật lý đoạt giải Nobel hiểu sâu bất kỳ kiến thức phức tạp nào chỉ bằng 4 bước giải thích đơn giản.',
        lessonText: 'Nếu bạn chưa thể giải thích điều gì cho một đứa trẻ 10 tuổi hiểu, bạn chưa thực sự nắm rõ nó.',
        scripts: [
          'Làm sao để học một kỹ năng mới nhanh gấp năm lần người bình thường? Hãy áp dụng kỹ thuật của nhà vật lý đoạt giải Nobel Richard Feynman. Bước một: Chọn chủ đề cần học. Bước hai: Giả vờ giảng lại kiến thức đó cho một đứa trẻ mười tuổi bằng ngôn từ đời thường nhất, tuyệt đối không dùng thuật ngữ rườm rà. Chỗ nào bạn bị vấp chính là lỗ hổng kiến thức cần lấp đầy ngay.',
          'Đọc đi đọc lại một cuốn sách chỉ tạo ra ảo giác là bạn đã thuộc bài. Chỉ khi bạn tự đóng sách lại và vẽ sơ đồ giải thích bằng lời của chính mình, kiến thức đó mới thực sự khắc sâu vào não bộ.'
        ],
        batchLines: [
          'Kỹ thuật Feynman (Feynman Technique): Bốn bước biến mọi kiến thức phức tạp thành phản xạ tự nhiên.',
          'Ảo giác năng lực khi học tập: Tại sao gạch chân sách nhiều màu không giúp bạn nhớ lâu hơn?',
          'Cách dùng sơ đồ vẽ tay đơn giản để tóm tắt cả một cuốn sách dày ba trăm trang trong năm phút.'
        ]
      }
    ]
  },

  story: {
    kind: 'story',
    label: '🎬 Hoạt hình 3D Pixar',
    defaultChannel: 'CHUYỆN NHỎ Ý LỚN',
    topics: [
      {
        id: 'bamboo_5_years',
        badge: '🎬 Pixar Storytelling',
        title: 'Cây Tre Mất 5 Năm Cắm Rễ Dưới Đất',
        videoTitle: 'BÍ MẬT CÂY TRE TRUNG HOA',
        summary: 'Câu chuyện cảm động về hạt giống cây tre nằm im 4 năm dưới lòng đất trước khi vươn cao 25 mét chỉ trong 6 tuần.',
        lessonText: 'Những tháng ngày âm thầm nỗ lực chưa thấy kết quả chính là lúc bộ rễ của bạn đang cắm sâu nhất.',
        scripts: [
          'Trong khu rừng nọ, có một mầm tre nhỏ bị các loài cây xung quanh chế giễu suốt bốn năm trời. Trong khi cây dương xỉ đã phủ xanh mặt đất, mầm tre vẫn chỉ nhú lên khỏi mặt đất vài xăng ti mét. Nhưng không ai biết rằng, dưới lòng đất tối tăm kia, bộ rễ của tre đang âm thầm lan rộng hàng trăm mét vuông. Đến năm thứ năm, chỉ trong sáu tuần mùa mưa, cây tre vọt thẳng lên cao hai mươi lăm mét, trở thành kẻ khổng lồ của khu rừng.',
          'Nếu hôm nay bạn đã cố gắng hết sức mà chưa thấy quả ngọt, đừng vội nản lòng. Bạn không hề dậm chân tại chỗ, bạn chỉ đang trong giai đoạn cắm rễ sâu như cây tre trước ngày bứt phá mà thôi.'
        ],
        batchLines: [
          'Cảnh 1: Mầm tre nhỏ bé bị các loài cây trong rừng chê cười vì bốn năm không lớn thêm chút nào.',
          'Cảnh 2: Góc nhìn xuyên lòng đất cho thấy bộ rễ tre khổng lồ đang âm thầm bám chặt vào từng tầng đá.',
          'Cảnh 3: Cơn mưa năm thứ năm ập đến, cây tre vươn cao hai mươi lăm mét chạm tới ánh mặt trời rực rỡ.'
        ]
      },
      {
        id: 'old_watch_value',
        badge: '💎 Bài học giá trị',
        title: 'Chiếc Đồng Hồ Cũ Và Đúng Nơi Thuộc Về',
        videoTitle: 'GIÁ TRỊ CỦA BẠN Ở ĐÚNG NƠI',
        summary: 'Cùng một chiếc đồng hồ cổ, tiệm cầm đồ trả 5 đô la nhưng viện bảo tàng trả 50.000 đô la.',
        lessonText: 'Đừng bao giờ ở lại nơi không nhận ra giá trị của bạn; hãy đến nơi bạn thực sự thuộc về.',
        scripts: [
          'Trước khi trao chiếc đồng hồ quả quýt cũ kỹ cho con trai, người cha bảo cậu mang nó ra tiệm tạp hóa đầu ngõ hỏi giá. Ông chủ tiệm nhìn qua rồi trả năm đô la vì nó đã trầy xước. Người cha lại bảo cậu mang đến tiệm cầm đồ, họ trả hai mươi đô la. Cuối cùng, khi cậu mang vào viện bảo tàng lịch sử, vị giám đốc đã thốt lên kinh ngạc và sẵn sàng trả năm mươi nghìn đô la cho kiệt tác hiếm có này.',
          'Người cha mỉm cười dặn con: Cùng một chiếc đồng hồ, nhưng đặt ở tiệm tạp hóa thì chỉ là sắt vụn, đặt ở bảo tàng mới là báu vật. Đừng bao giờ buồn khi ai đó coi thường bạn, hãy rời đi và tìm đến đúng nơi trân trọng giá trị của mình.'
        ],
        batchLines: [
          'Cảnh 1: Người cha trao cho con trai chiếc đồng hồ cổ phủ bụi và thử thách hỏi giá ở tiệm tạp hóa.',
          'Cảnh 2: Sự thờ ơ của chủ tiệm cầm đồ khi chỉ định giá chiếc đồng hồ bằng vài đồng bạc lẻ.',
          'Cảnh 3: Ánh sáng rực rỡ trong viện bảo tàng khi chiếc đồng hồ được vinh danh là báu vật vô giá.'
        ]
      }
    ]
  },

  anime: {
    kind: 'anime',
    label: '🌸 Anime Nhật Bản 2D',
    defaultChannel: 'IKIGAI STUDIO',
    topics: [
      {
        id: 'ikigai_morning',
        badge: '🌸 Triết lý Nhật Bản',
        title: 'Bí Mật Ikigai — Lý Do Thức Dậy Mỗi Sáng',
        videoTitle: 'TRIẾT LÝ IKIGAI NHẬT BẢN',
        summary: 'Giao điểm của 4 vòng tròn: Thứ bạn yêu, thứ bạn giỏi, thứ thế giới cần và thứ tạo ra thu nhập.',
        lessonText: 'Hạnh phúc không phải là đích đến xa xôi, mà là tìm thấy ý nghĩa trong từng việc nhỏ mỗi sáng.',
        scripts: [
          'Dưới bầu trời rực nắng của vùng đảo Okinawa Nhật Bản, những cụ già ngoài chín mươi tuổi vẫn mỉm cười làm việc mỗi sáng nhờ một từ duy nhất: Ikigai, nghĩa là lý do để thức dậy. Khi bạn tìm được điểm giao thoa giữa bốn điều: Việc bạn yêu thích, việc bạn làm giỏi, việc xã hội sẵn sàng trả tiền và việc mang lại giá trị cho đời, mọi mỏi mệt đều tan biến thành niềm vui thuần khiết.',
          'Đừng chạy theo một cuộc đời hào nhoáng trong mắt người khác nhưng lại trống rỗng trong tim mình. Hãy lắng nghe nhịp đập thật sự bên trong bạn dưới ánh hoàng hôn bình yên.'
        ],
        batchLines: [
          'Bình minh rực rỡ phong cách Shinkai trên thị trấn ven biển Nhật Bản với triết lý sống Ikigai.',
          'Bốn vòng tròn định mệnh tạo nên một cuộc đời vừa có thu nhập cao vừa tràn ngập bình an nội tâm.',
          'Khoảnh khắc nhân vật đứng dưới cơn mưa hoa anh đào nhận ra lý do thật sự để mỉm cười mỗi ngày.'
        ]
      },
      {
        id: 'kintsugi_gold',
        badge: '✨ Chữa lành thẩm mỹ',
        title: 'Nghệ Thuật Kintsugi — Hàn Gắn Vết Nứt Bằng Vàng',
        videoTitle: 'VẾT NỨT ĐƯỢC HÀN BẰNG VÀNG',
        summary: 'Người Nhật không vứt bỏ chiếc bát vỡ mà dùng sơn mài phủ vàng ròng để biến vết sẹo thành vẻ đẹp độc bản.',
        lessonText: 'Những tổn thương bạn từng vượt qua chính là đường chỉ vàng làm nên bản lĩnh độc nhất của bạn.',
        scripts: [
          'Khi một chiếc bát gốm quý bị rơi vỡ, người Nhật không đem vứt đi hay cố giấu nhẹm vết nứt. Họ dùng nghệ thuật Kintsugi, trộn sơn mài với bột vàng ròng nguyên chất để gắn kết từng mảnh vỡ lại với nhau. Chiếc bát sau khi đi qua đổ vỡ không những vững chắc hơn xưa, mà những đường vân vàng lấp lánh dưới nắng còn biến nó thành tác phẩm độc nhất vô nhị.',
          'Tâm hồn của bạn cũng giống như chiếc bát gốm ấy. Đừng xấu hổ vì những vết sẹo của quá khứ, bởi chính nơi từng rạn nứt là nơi ánh sáng vàng của sự trưởng thành chiếu rọi rực rỡ nhất.'
        ],
        batchLines: [
          'Nghệ thuật Kintsugi Nhật Bản: Khi những mảnh gốm vỡ được nâng niu và hàn gắn bằng dòng vàng lấp lánh.',
          'Ẩn dụ chữa lành: Những vết sẹo trong quá khứ không làm bạn mất giá trị mà biến bạn thành phiên bản độc bản.',
          'Khung cảnh hoàng hôn ấm áp chiếu qua khung cửa gỗ lên chiếc bát gốm điểm xuyết những đường chỉ vàng.'
        ]
      }
    ]
  },

  cinematic: {
    kind: 'cinematic',
    label: '🎥 Điện ảnh Thực tế 4K',
    defaultChannel: 'APEX MINDSET',
    topics: [
      {
        id: 'lone_wolf_success',
        badge: '🎥 Cinematic 4K',
        title: 'Cái Giá Của Đỉnh Cao — Sự Cô Độc Cần Thiết',
        videoTitle: 'ĐỈNH CAO LUÔN CẦN SỰ TĨNH LẶNG',
        summary: 'Hình ảnh điện ảnh 4K về những giờ làm việc dưới ánh đèn đêm khi cả thành phố đã chìm vào giấc ngủ.',
        lessonText: 'Đại bàng luôn bay một mình trên bầu trời cao; đừng sợ giai đoạn phải đi một mình.',
        scripts: [
          'Giữa thành phố rực ánh đèn neon lúc hai giờ sáng, khi tất cả mọi người đã chìm vào giấc ngủ êm ấm, đó là lúc khoảng cách giữa người dẫn đầu và đám đông được tạo ra. Sự xuất chúng không được sinh ra trong những buổi tiệc ồn ào, nó được rèn giũa trong sự tĩnh lặng tuyệt đối của những đêm dài kiên trì. Đừng sợ quãng thời gian phải bước đi một mình, vì đường lên đỉnh núi chưa bao giờ dành cho số đông.',
          'Mọi ánh hào quang rực rỡ trên sân khấu đều được đánh đổi bằng hàng ngàn giờ đổ mồ hôi trong bóng tối không một ai vỗ tay.'
        ],
        batchLines: [
          'Góc máy điện ảnh 4K nhìn từ căn phòng làm việc trên tầng cao xuống đại lộ thành phố đêm mưa.',
          'Khoảnh khắc tập trung tuyệt đối bên ánh đèn bàn ấm áp khi đồng hồ điểm hai giờ sáng.',
          'Ánh bình minh vàng rực chiếu qua tòa nhà kính hiện đại, mở ra đỉnh cao mới của người kiên trì.'
        ]
      },
      {
        id: 'stoic_calm_storm',
        badge: '⚡ Bản lĩnh Khắc kỷ',
        title: 'Tâm Bất Biến Giữa Dòng Đời Vạn Biến (Stoicism)',
        videoTitle: 'BẢN LĨNH NGƯỜI KHẮC KỶ',
        summary: 'Giữ cái đầu lạnh và nhịp thở điềm tĩnh giữa tâm bão khủng hoảng theo triết lý Khắc kỷ La Mã.',
        lessonText: 'Bạn không điều khiển được cơn bão bên ngoài, nhưng bạn toàn quyền làm chủ tay lái của chính mình.',
        scripts: [
          'Hoàng đế La Mã Marcus Aurelius từng viết giữa chiến trường khốc liệt: Bạn có quyền năng tuyệt đối với tâm trí mình, chứ không phải với các sự kiện bên ngoài; nhận ra điều này, bạn sẽ tìm thấy sức mạnh. Giữa một thế giới hỗn loạn và đầy biến động, người mạnh nhất không phải là người gào thét to nhất, mà là người giữ được ánh mắt tĩnh lặng như mặt hồ sâu trước mọi cơn bão.',
          'Cơn giận dữ chỉ là sự bất lực nhất thời của lý trí. Khi bạn làm chủ được ba giây khoảng lặng trước khi phản ứng, không một ai trên đời có thể điều khiển được cảm xúc của bạn.'
        ],
        batchLines: [
          'Khung cảnh điện ảnh 4K một người đàn ông đứng điềm tĩnh giữa đại lộ tấp nập chuyển động nhanh (Hyperlapse).',
          'Triết lý Khắc kỷ (Stoicism): Tách biệt hoàn toàn những thứ nằm trong tầm kiểm soát và những thứ ngoài tầm kiểm soát.',
          'Ánh sáng điện ảnh tương phản cao khắc họa sự điềm tĩnh tuyệt đối trước mọi biến cố cuộc đời.'
        ]
      }
    ]
  }
};

/**
 * Return all style categories and their topics, prioritizing the requested `kind`.
 */
function getTopicCatalog(kind = 'psych_split') {
  const categories = Object.values(STYLE_TOPIC_CATALOG);
  const activeCategory = STYLE_TOPIC_CATALOG[kind] || STYLE_TOPIC_CATALOG.psych_split;
  return {
    activeKind: activeCategory.kind,
    activeCategory,
    categories
  };
}

/**
 * Generate a complete script + metadata from either a preset `topicId` or a `customTopic` keyword.
 */
function generateScriptByTopic({
  kind = 'psych_split',
  topicId = '',
  customTopic = '',
  variantIndex = null
} = {}) {
  const category = STYLE_TOPIC_CATALOG[kind] || STYLE_TOPIC_CATALOG.psych_split;

  // 1. Custom keyword/topic entered by user
  const cleanCustom = String(customTopic || '').trim();
  if (cleanCustom) {
    const upperTitle = cleanCustom.toUpperCase().slice(0, 42);
    const customScriptsByKind = {
      psych_split:
        `Trong cuộc sống, rất nhiều người đang âm thầm mắc kẹt trong hiện tượng "${cleanCustom}" mà không hề nhận ra. ` +
        `Bề ngoài họ có vẻ hoàn toàn bình thường, nhưng sâu bên trong là cơ chế phòng vệ tâm lý luôn căng như dây đàn. ` +
        `Trong tâm lý học hành vi, việc nhận diện đúng bản chất của "${cleanCustom}" chính là chìa khóa đầu tiên để bạn bảo vệ năng lượng cảm xúc, giữ vững ranh giới cá nhân và không để người khác dẫn dắt tâm trí mình.`,
      pictogram:
        `Tám mươi phần trăm mọi người hiểu sai hoàn toàn về "${cleanCustom}" và phải trả giá bằng chính thời gian của mình. ` +
        `Hãy nhìn vào cơ chế thực tế: Khi bạn tiếp cận "${cleanCustom}" theo đám đông, bạn luôn là người chịu thiệt. ` +
        `Nhưng khi bóc tách quy luật cốt lõi và tập trung vào hai mươi phần trăm hành động tạo ra đòn bẩy thật sự, bạn sẽ lật ngược thế cờ chỉ trong ba mươi ngày.`,
      psych_surreal:
        `Bên dưới bề mặt tưởng chừng tĩnh lặng của "${cleanCustom}" là cả một thế giới nội tâm đầy giằng xé mà ít ai dám gọi tên. ` +
        `Giống như chiếc bóng vô hình luôn đi theo mỗi bước chân, càng cố trốn tránh "${cleanCustom}" thì nó lại càng chi phối các quyết định của bạn. ` +
        `Chỉ khi bạn dũng cảm quay lại đối diện và thấu hiểu thông điệp ẩn sau đó, cánh cửa tự do trong tâm trí mới thực sự mở ra.`,
      default:
        `Đây là sự thật ít người nói với bạn về "${cleanCustom}". ` +
        `Thay vì chạy theo những lời khuyên sáo rỗng trên mạng, hãy nhìn thẳng vào bản chất cốt lõi tạo nên sự khác biệt giữa người thành công và số đông. ` +
        `Khi bạn nắm vững nguyên lý của "${cleanCustom}" và áp dụng đều đặn mỗi ngày, kết quả sẽ thay đổi vượt xa kỳ vọng của bạn.`
    };

    const script = customScriptsByKind[kind] || customScriptsByKind.default;
    const batchLines = [
      `Sự thật tâm lý đằng sau "${cleanCustom}" mà ít người dám nhìn thẳng vào.`,
      `Ba dấu hiệu nhận biết "${cleanCustom}" đang ảnh hưởng trực tiếp đến cuộc sống và công việc của bạn.`,
      `Giải pháp thực chiến giúp làm chủ "${cleanCustom}" để bứt phá và giữ bình an nội tâm.`
    ];

    return {
      kind: category.kind,
      topicId: 'custom_topic',
      topicTitle: cleanCustom,
      channelName: category.defaultChannel,
      videoTitle: upperTitle,
      lessonText: `Thấu hiểu bản chất của "${cleanCustom}" để làm chủ cảm xúc và hành động mỗi ngày.`,
      script,
      batchLines
    };
  }

  // 2. Curated topic from catalog
  const randomTopicFromCat =
    category.topics[Math.floor(Math.random() * category.topics.length)] || category.topics[0];
  const matchedTopic =
    (topicId && category.topics.find((t) => t.id === topicId)) ||
    (topicId &&
      Object.values(STYLE_TOPIC_CATALOG)
        .flatMap((c) => c.topics)
        .find((t) => t.id === topicId)) ||
    randomTopicFromCat;

  const scripts = matchedTopic.scripts || [];
  const chosenIdx =
    typeof variantIndex === 'number' && variantIndex >= 0
      ? variantIndex % scripts.length
      : Math.floor(Math.random() * scripts.length);

  return {
    kind: category.kind,
    topicId: matchedTopic.id,
    topicTitle: matchedTopic.title,
    badge: matchedTopic.badge,
    channelName: category.defaultChannel,
    videoTitle: matchedTopic.videoTitle,
    lessonText: matchedTopic.lessonText,
    script: scripts[chosenIdx] || scripts[0] || '',
    batchLines: matchedTopic.batchLines || []
  };
}

module.exports = {
  STYLE_TOPIC_CATALOG,
  getTopicCatalog,
  generateScriptByTopic
};
